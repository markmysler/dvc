// Challenge JSON Schema for AJV validation
// Defines the structure and constraints for challenge definitions

const challengeSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://dvc.local/schemas/challenge.json",
  title: "Challenge Definition",
  description: "Schema for Damn Vulnerable Containers challenge definitions",
  type: "object",
  required: ["schema_version", "challenges"],
  properties: {
    schema_version: {
      type: "string",
      pattern: "^\\d+\\.\\d+$",
      description: "Version of the schema format (e.g., '1.0')"
    },
    challenges: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      description: "Array of challenge definitions",
      items: {
        $ref: "#/$defs/challenge"
      }
    }
  },
  $defs: {
    challenge: {
      type: "object",
      required: ["id", "name", "description", "difficulty", "category", "points", "container_spec"],
      properties: {
        id: {
          type: "string",
          pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$",
          minLength: 3,
          maxLength: 50,
          description: "Unique identifier, kebab-case, alphanumeric with hyphens"
        },
        name: {
          type: "string",
          minLength: 5,
          maxLength: 100,
          description: "Human-readable challenge name"
        },
        description: {
          type: "string",
          minLength: 20,
          maxLength: 500,
          description: "Challenge description for users"
        },
        difficulty: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced", "expert"],
          description: "Challenge difficulty level"
        },
        category: {
          type: "string",
          enum: ["web", "crypto", "reverse", "pwn", "forensics", "misc"],
          description: "Challenge category"
        },
        points: {
          type: "integer",
          minimum: 50,
          maximum: 1000,
          multipleOf: 25,
          description: "Points awarded for completion (multiples of 25)"
        },
        tags: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          uniqueItems: true,
          items: {
            type: "string",
            pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$",
            minLength: 1,
            maxLength: 20
          },
          description: "Array of lowercase tags for categorization"
        },
        container_spec: {
          $ref: "#/$defs/containerSpec"
        },
        metadata: {
          $ref: "#/$defs/metadata"
        }
      },
      additionalProperties: false
    },
    containerSpec: {
      type: "object",
      required: ["image"],
      properties: {
        image: {
          type: "string",
          pattern: "^[a-z0-9][a-z0-9.-]*[a-z0-9](:[a-z0-9][a-z0-9.-]*[a-z0-9])?$",
          minLength: 5,
          maxLength: 200,
          description: "Docker image name with optional tag"
        },
        ports: {
          type: "object",
          maxProperties: 5,
          patternProperties: {
            "^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$": {
              oneOf: [
                { type: "null" },
                {
                  type: "integer",
                  minimum: 1024,
                  maximum: 65535
                }
              ]
            }
          },
          additionalProperties: false,
          description: "Port mapping: container_port -> host_port (null for dynamic)"
        },
        environment: {
          type: "object",
          maxProperties: 20,
          patternProperties: {
            "^[A-Z][A-Z0-9_]*$": {
              type: "string",
              maxLength: 1000
            }
          },
          additionalProperties: false,
          description: "Environment variables (UPPERCASE_WITH_UNDERSCORES)"
        },
        volumes: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            required: ["type", "target"],
            properties: {
              type: {
                type: "string",
                enum: ["tmpfs", "volume"],
                description: "Only tmpfs and named volumes allowed for security"
              },
              source: {
                type: "string",
                pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$",
                minLength: 1,
                maxLength: 50,
                description: "Volume name for type=volume (ignored for tmpfs)"
              },
              target: {
                type: "string",
                pattern: "^/[a-zA-Z0-9][a-zA-Z0-9/._-]*[a-zA-Z0-9]$",
                maxLength: 100,
                description: "Mount point inside container (absolute path)"
              },
              readonly: {
                type: "boolean",
                default: false
              }
            },
            additionalProperties: false,
            if: {
              properties: { type: { const: "volume" } }
            },
            then: {
              required: ["source"]
            }
          },
          description: "Volume mounts (security-restricted)"
        },
        resource_limits: {
          type: "object",
          properties: {
            memory: {
              type: "string",
              pattern: "^[1-9][0-9]*[kmgtKMGT]?[bB]?$",
              description: "Memory limit (e.g., '512m', '1g')"
            },
            cpus: {
              type: "string",
              pattern: "^(0\\.[1-9]|[1-4]\\.?[0-9]?)$",
              description: "CPU limit as decimal (e.g., '0.5', '2.0', max 4.0)"
            },
            pids_limit: {
              type: "integer",
              minimum: 32,
              maximum: 1024,
              description: "Maximum processes limit"
            }
          },
          additionalProperties: false
        },
        security_profile: {
          type: "string",
          enum: ["challenge", "isolated", "restricted"],
          default: "challenge",
          description: "Predefined security configuration"
        },
        privileged: {
          type: "boolean",
          const: false,
          description: "Privileged mode is explicitly forbidden"
        },
        capabilities: {
          type: "object",
          properties: {
            add: {
              type: "array",
              maxItems: 3,
              items: {
                type: "string",
                enum: ["NET_ADMIN", "NET_RAW", "SYS_TIME"],
                description: "Whitelist of allowed capabilities"
              },
              uniqueItems: true
            },
            drop: {
              type: "array",
              items: {
                type: "string",
                pattern: "^[A-Z_]+$"
              },
              uniqueItems: true,
              description: "Capabilities to drop (in addition to defaults)"
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    metadata: {
      type: "object",
      properties: {
        author: {
          type: "string",
          minLength: 2,
          maxLength: 100,
          description: "Challenge author name"
        },
        created: {
          type: "string",
          format: "date",
          description: "Creation date (YYYY-MM-DD)"
        },
        updated: {
          type: "string",
          format: "date",
          description: "Last update date (YYYY-MM-DD)"
        },
        version: {
          type: "string",
          pattern: "^\\d+\\.\\d+(\\.\\d+)?$",
          description: "Challenge version (semver)"
        },
        learning_objectives: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "string",
            minLength: 10,
            maxLength: 200
          },
          description: "What users should learn"
        },
        hints: {
          type: "array",
          maxItems: 5,
          items: {
            type: "string",
            minLength: 10,
            maxLength: 300
          },
          description: "Optional hints for users"
        },
        solution_url: {
          type: "string",
          format: "uri-reference",
          maxLength: 200,
          description: "Relative path to solution documentation"
        },
        estimated_time: {
          type: "string",
          pattern: "^\\d+(-\\d+)? (minutes?|hours?)$",
          description: "Estimated completion time (e.g., '15-30 minutes')"
        }
      },
      additionalProperties: false
    }
  }
};

// Single challenge schema for validating individual challenges
const singleChallengeSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://dvc.local/schemas/single-challenge.json",
  title: "Single Challenge Definition",
  description: "Schema for validating a single challenge",
  ...challengeSchema.$defs.challenge
};

module.exports = {
  challengeSchema,
  singleChallengeSchema
};