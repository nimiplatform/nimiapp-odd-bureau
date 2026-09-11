import { composeStudioCapabilityRuntimeHandlers } from '../../capabilities/ai-studio-core/index.js';
import { studioMediaRuntimeHandlers } from '../../capabilities/studio-media/index.js';
import { studioVoiceRuntimeHandlers } from '../../capabilities/studio-voice/index.js';

export const generatedStudioRuntimeHandlers = composeStudioCapabilityRuntimeHandlers([
  studioMediaRuntimeHandlers,
  studioVoiceRuntimeHandlers,
]);
