// Container Security Validation
// Validates container specifications for security compliance

const path = require('path');

/**
 * Security rules for container validation
 */
const SECURITY_RULES = {
  // Forbidden Docker options
  FORBIDDEN_OPTIONS: [
    'privileged',
    'pid_mode',
    'network_mode', // except 'bridge' and 'none'
    'ipc_mode',
    'uts_mode',
    'user_ns_mode',
    'cap_add', // handled separately with whitelist
    'security_opt',
    'devices',
    'device_cgroup_rules',
    'sysctls',
    'ulimits'
  ],

  // Allowed capabilities (very restrictive whitelist)
  ALLOWED_CAPABILITIES: [
    'NET_ADMIN', // For network challenges
    'NET_RAW',   // For raw sockets
    'SYS_TIME'   // For time-related challenges
  ],

  // Dangerous volume mount patterns
  DANGEROUS_VOLUME_PATTERNS: [
    /^\/var\/run\/docker\.sock$/,    // Docker socket
    /^\/proc$/,                       // Process filesystem
    /^\/sys$/,                        // System filesystem
    /^\/dev$/,                        // Device filesystem
    /^\/etc\/passwd$/,                // System password file
    /^\/etc\/shadow$/,                // System shadow file
    /^\/etc\/sudoers/,                // Sudo configuration
    /^\/root$/,                       // Root home directory
    /^\/home\/[^\/]+$/,              // User home directories
    /^\/usr\/bin$/,                   // System binaries
    /^\/bin$/,                        // System binaries
    /^\/sbin$/,                       // System binaries
    /^\/usr\/sbin$/,                  // System binaries
    /^\/$/                            // Root filesystem
  ],

  // Maximum resource limits
  MAX_MEMORY: '2g',
  MAX_CPUS: 4.0,
  MAX_PIDS: 1024,
  MAX_PORTS: 5,
  MAX_ENV_VARS: 20,
  MAX_VOLUMES: 3
};

/**
 * Validates container security configuration
 * @param {Object} containerSpec - Container specification to validate
 * @returns {Object} Validation result with errors and warnings
 */
function validateContainerSecurity(containerSpec) {
  const errors = [];
  const warnings = [];
  const suggestions = [];

  if (!containerSpec || typeof containerSpec !== 'object') {
    return {
      valid: false,
      errors: ['Container specification is required and must be an object'],
      warnings: [],
      suggestions: []
    };
  }

  // Check for privileged mode
  if (containerSpec.privileged === true) {
    errors.push('Privileged mode is strictly forbidden for security reasons');
    suggestions.push('Remove "privileged: true" from container specification');
  }

  // Validate capabilities
  if (containerSpec.capabilities) {
    const { add: addCaps, drop: dropCaps } = containerSpec.capabilities;

    if (addCaps && Array.isArray(addCaps)) {
      const invalidCaps = addCaps.filter(cap => !SECURITY_RULES.ALLOWED_CAPABILITIES.includes(cap));
      if (invalidCaps.length > 0) {
        errors.push(`Forbidden capabilities detected: ${invalidCaps.join(', ')}`);
        suggestions.push(`Only these capabilities are allowed: ${SECURITY_RULES.ALLOWED_CAPABILITIES.join(', ')}`);
      }

      if (addCaps.length > 3) {
        errors.push('Maximum of 3 additional capabilities allowed');
        suggestions.push('Reduce the number of added capabilities to 3 or fewer');
      }
    }
  }

  // Validate volume mounts
  if (containerSpec.volumes && Array.isArray(containerSpec.volumes)) {
    containerSpec.volumes.forEach((volume, index) => {
      if (!volume.target) {
        errors.push(`Volume ${index + 1}: target path is required`);
        return;
      }

      const target = volume.target;

      // Check against dangerous patterns
      const isDangerous = SECURITY_RULES.DANGEROUS_VOLUME_PATTERNS.some(pattern =>
        pattern.test(target)
      );

      if (isDangerous) {
        errors.push(`Volume ${index + 1}: Dangerous mount path detected: ${target}`);
        suggestions.push('Mount paths should be limited to application-specific directories like /app, /data, /tmp');
      }

      // Validate volume type
      if (volume.type === 'bind') {
        errors.push(`Volume ${index + 1}: Bind mounts are not allowed for security`);
        suggestions.push('Use named volumes or tmpfs mounts instead');
      }

      if (!volume.type || (volume.type !== 'tmpfs' && volume.type !== 'volume')) {
        errors.push(`Volume ${index + 1}: Only 'tmpfs' and 'volume' types are allowed`);
        suggestions.push('Change volume type to either "tmpfs" or "volume"');
      }

      // Validate path format
      if (!target.startsWith('/')) {
        errors.push(`Volume ${index + 1}: Target path must be absolute (start with /)`);
        suggestions.push('Change target path to an absolute path starting with /');
      }

      if (target.includes('..')) {
        errors.push(`Volume ${index + 1}: Path traversal detected in target: ${target}`);
        suggestions.push('Remove ".." from mount paths');
      }
    });

    if (containerSpec.volumes.length > SECURITY_RULES.MAX_VOLUMES) {
      errors.push(`Maximum of ${SECURITY_RULES.MAX_VOLUMES} volumes allowed`);
      suggestions.push(`Reduce volume count to ${SECURITY_RULES.MAX_VOLUMES} or fewer`);
    }
  }

  // Validate environment variables
  if (containerSpec.environment) {
    const envVars = Object.keys(containerSpec.environment);

    if (envVars.length > SECURITY_RULES.MAX_ENV_VARS) {
      warnings.push(`Large number of environment variables (${envVars.length}), consider reducing`);
    }

    // Check for potentially dangerous env vars
    const dangerousEnvVars = envVars.filter(key =>
      key.includes('PASSWORD') ||
      key.includes('SECRET') ||
      key.includes('TOKEN') ||
      key.includes('KEY') && !key.includes('FLAG')
    );

    if (dangerousEnvVars.length > 0) {
      warnings.push(`Environment variables containing secrets detected: ${dangerousEnvVars.join(', ')}`);
      suggestions.push('Avoid hardcoding secrets in environment variables, use Docker secrets or config instead');
    }

    // Validate FLAG environment variable presence
    if (!envVars.includes('FLAG')) {
      warnings.push('No FLAG environment variable found');
      suggestions.push('Add a FLAG environment variable for challenge completion validation');
    }
  }

  // Validate port mappings
  if (containerSpec.ports) {
    const portCount = Object.keys(containerSpec.ports).length;
    if (portCount > SECURITY_RULES.MAX_PORTS) {
      errors.push(`Maximum of ${SECURITY_RULES.MAX_PORTS} ports allowed`);
      suggestions.push(`Reduce port mappings to ${SECURITY_RULES.MAX_PORTS} or fewer`);
    }

    // Check for privileged ports
    Object.keys(containerSpec.ports).forEach(containerPort => {
      const port = parseInt(containerPort, 10);
      if (port < 1024) {
        warnings.push(`Container port ${port} is a privileged port`);
        suggestions.push('Consider using ports above 1024 for better security');
      }
    });
  }

  // Validate resource limits
  if (containerSpec.resource_limits) {
    const { memory, cpus, pids_limit } = containerSpec.resource_limits;

    if (pids_limit && pids_limit > SECURITY_RULES.MAX_PIDS) {
      errors.push(`PID limit exceeds maximum allowed (${SECURITY_RULES.MAX_PIDS})`);
      suggestions.push(`Set pids_limit to ${SECURITY_RULES.MAX_PIDS} or lower`);
    }

    if (cpus) {
      const cpuFloat = parseFloat(cpus);
      if (cpuFloat > SECURITY_RULES.MAX_CPUS) {
        errors.push(`CPU limit exceeds maximum allowed (${SECURITY_RULES.MAX_CPUS})`);
        suggestions.push(`Set CPU limit to ${SECURITY_RULES.MAX_CPUS} or lower`);
      }
    }
  } else {
    warnings.push('No resource limits specified');
    suggestions.push('Add resource_limits to prevent resource exhaustion');
  }

  // Validate security profile
  const validProfiles = ['challenge', 'isolated', 'restricted'];
  if (containerSpec.security_profile && !validProfiles.includes(containerSpec.security_profile)) {
    errors.push(`Invalid security profile: ${containerSpec.security_profile}`);
    suggestions.push(`Use one of: ${validProfiles.join(', ')}`);
  }

  // Validate image name for suspicious patterns
  if (containerSpec.image) {
    const image = containerSpec.image;

    // Check for latest tag
    if (image.endsWith(':latest') || !image.includes(':')) {
      warnings.push('Using :latest tag or no tag is not recommended');
      suggestions.push('Pin to specific version tags for reproducible builds');
    }

    // Check for suspicious image names
    const suspiciousPatterns = [
      /docker\.io\/library\/ubuntu/,
      /docker\.io\/library\/debian/,
      /docker\.io\/library\/centos/,
      /docker\.io\/library\/alpine/
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(image));
    if (isSuspicious) {
      warnings.push('Using base OS images directly may indicate insufficient challenge preparation');
      suggestions.push('Consider using purpose-built challenge images with pre-configured vulnerabilities');
    }
  }

  // Check for Docker-in-Docker patterns
  if (containerSpec.volumes && containerSpec.volumes.some(v =>
      v.target && v.target.includes('docker') ||
      (v.source && v.source.includes('docker'))
  )) {
    errors.push('Docker-in-Docker configuration detected');
    suggestions.push('Remove Docker-related volume mounts for security');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info'
  };
}

/**
 * Validates an entire challenge definition for security issues
 * @param {Object} challenge - Full challenge object
 * @returns {Object} Security validation result
 */
function validateChallengeSecurityComplete(challenge) {
  if (!challenge.container_spec) {
    return {
      valid: false,
      errors: ['Challenge must include container_spec'],
      warnings: [],
      suggestions: ['Add a container_spec section to your challenge definition']
    };
  }

  const result = validateContainerSecurity(challenge.container_spec);

  // Additional challenge-level security checks
  if (challenge.id && challenge.id.includes('..')) {
    result.errors.push('Challenge ID contains path traversal characters');
    result.suggestions.push('Use only alphanumeric characters and hyphens in challenge IDs');
    result.valid = false;
  }

  return result;
}

/**
 * Generates security recommendations for container spec
 * @param {Object} containerSpec - Container specification
 * @returns {Array} Array of security recommendations
 */
function generateSecurityRecommendations(containerSpec) {
  const recommendations = [];

  if (!containerSpec.resource_limits) {
    recommendations.push('Add resource limits to prevent resource exhaustion attacks');
  }

  if (!containerSpec.security_profile || containerSpec.security_profile === 'challenge') {
    recommendations.push('Consider using "restricted" security profile for maximum isolation');
  }

  if (containerSpec.capabilities && containerSpec.capabilities.add) {
    recommendations.push('Review added capabilities - only add what is absolutely necessary');
  }

  if (!containerSpec.environment || !containerSpec.environment.FLAG) {
    recommendations.push('Ensure a FLAG environment variable is set for challenge validation');
  }

  return recommendations;
}

module.exports = {
  validateContainerSecurity,
  validateChallengeSecurityComplete,
  generateSecurityRecommendations,
  SECURITY_RULES
};