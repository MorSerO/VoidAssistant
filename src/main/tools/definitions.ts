import type { ToolDefinition } from '../../shared/types';

/**
 * Get the full list of tool definitions available to the LLM.
 * These follow the OpenAI Function Calling format.
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the content of a note file bound to the current learning module.',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The absolute path of the note file to read.',
            },
          },
          required: ['filePath'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'propose_edit',
        description: 'Suggest a new full content for a note file. The edit will NOT be applied until the user confirms it in the diff viewer.',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'The absolute path of the note file to edit.',
            },
            newContent: {
              type: 'string',
              description: 'The complete new content for the file. This will replace the existing content entirely.',
            },
          },
          required: ['filePath', 'newContent'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_plans',
        description: 'Retrieve all current user plans and their items. Use this to understand the user\'s current goals before suggesting changes.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_plan',
        description: 'Update an existing plan with new items, modified items, or structural changes. Changes are applied immediately but can be reviewed.',
        parameters: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'The ID of the plan to update.',
            },
            updatedPlan: {
              type: 'object',
              description: 'The updated plan object with modified fields (title, items, type).',
            },
          },
          required: ['planId', 'updatedPlan'],
        },
      },
    },
  ];
}
