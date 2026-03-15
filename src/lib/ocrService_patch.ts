// Patch per aggiungere Organization ID agli headers OpenAI

// Linea 800-823: Aggiornare la funzione callOpenAIChatCompletions
async function callOpenAIChatCompletions(base64Image: string, prompt: string): Promise<string> {
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
  const OPENAI_PROJECT_ID = import.meta.env.VITE_OPENAI_PROJECT_ID || '';
  const OPENAI_ORG_ID = import.meta.env.VITE_OPENAI_ORG_ID || '';
  
  if (!OPENAI_API_KEY) {
    throw new Error('VITE_OPENAI_API_KEY not configured. Please add it to your .env file.');
  }

  const modelName = getOpenAIModel();
  console.log('🤖 Using OpenAI model:', modelName, 'via Chat Completions API');
  console.log('🔵 OpenAI Chat Completions API (traditional endpoint)');
  
  // 🔥 BUILD HEADERS WITH PROJECT ID AND ORGANIZATION ID
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  };
  
  // Add Organization ID header if available
  if (OPENAI_ORG_ID) {
    headers['OpenAI-Organization'] = OPENAI_ORG_ID;
    console.log('🏢 Using Organization ID:', OPENAI_ORG_ID);
  } else {
    console.warn('⚠️ No Organization ID configured. Add VITE_OPENAI_ORG_ID to .env file.');
  }
  
  // Add Project ID header if available
  if (OPENAI_PROJECT_ID) {
    headers['OpenAI-Project'] = OPENAI_PROJECT_ID;
    console.log('🔑 Using Project ID:', OPENAI_PROJECT_ID);
  } else {
    console.warn('⚠️ No Project ID configured. Add VITE_OPENAI_PROJECT_ID to .env file.');
  }
  
  // ... resto del codice rimane uguale
}

// Linea 722-743: Aggiornare anche callOpenAIResponsesAPI
async function callOpenAIResponsesAPI(base64Image: string, prompt: string): Promise<string> {
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
  const OPENAI_PROJECT_ID = import.meta.env.VITE_OPENAI_PROJECT_ID || '';
  const OPENAI_ORG_ID = import.meta.env.VITE_OPENAI_ORG_ID || '';
  
  if (!OPENAI_API_KEY) {
    throw new Error('VITE_OPENAI_API_KEY not configured. Please add it to your .env file.');
  }

  const modelName = getOpenAIModel();
  console.log('🤖 Using OpenAI model:', modelName, 'via Responses API');
  console.log('🟣 OpenAI Responses API (new endpoint)');
  
  // Build headers with Organization ID and Project ID
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  };
  
  if (OPENAI_ORG_ID) {
    headers['OpenAI-Organization'] = OPENAI_ORG_ID;
    console.log('🏢 Using Organization ID:', OPENAI_ORG_ID);
  }
  
  if (OPENAI_PROJECT_ID) {
    headers['OpenAI-Project'] = OPENAI_PROJECT_ID;
    console.log('🔑 Using Project ID:', OPENAI_PROJECT_ID);
  }
  
  // ... resto del codice rimane uguale
}
