import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Service to handle batch CRM mapping using Gemini or OpenAI.
 * Includes a full mock fallback engine for offline evaluation.
 */
class AIService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'gemini';
    this.initClients();
  }

  initClients() {
    // Initialize Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: geminiKey });
      } catch (err) {
        console.error('Failed to initialize Gemini Client:', err.message);
      }
    }

    // Initialize OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
      } catch (err) {
        console.error('Failed to initialize OpenAI Client:', err.message);
      }
    }
  }

  /**
   * Process a batch of records using the selected LLM provider.
   * If the API keys are not present, it automatically falls back to the local Mock AI processor.
   * @param {string[]} headers - The headers of the uploaded CSV.
   * @param {Object[]} records - The batch of raw records.
   * @returns {Promise<Object[]>} The mapped records.
   */
  async processBatch(headers, records) {
    const activeClient = this.provider === 'gemini' ? this.geminiClient : this.openaiClient;

    if (!activeClient) {
      console.warn(`[AI Engine] ${this.provider.toUpperCase()} API key is not configured. Falling back to local Mock AI Engine.`);
      // Add slight delay to simulate network/AI processing latency
      await new Promise(resolve => setTimeout(resolve, 800));
      return this.processMockBatch(headers, records);
    }

    const systemPrompt = `You are an expert CRM Data Engineer. Your task is to analyze a batch of raw lead records from an uploaded CSV file and map them into the GrowEasy CRM schema.

The raw CSV column headers are:
${JSON.stringify(headers)}

Here is the batch of raw records to process:
${JSON.stringify(records)}

Map each raw record to the GrowEasy CRM schema according to the following strict rules:

TARGET CRM FIELDS:
1. created_at: Lead creation date. Must be formatted in a way that JavaScript 'new Date(created_at)' can parse it (e.g. 'YYYY-MM-DD HH:mm:ss' or ISO 8601). If missing, unparseable, or invalid in the raw row, leave it blank or default to the current date/time.
2. name: Full name of the lead. If split into First/Last name, combine them.
3. email: Primary email address. If multiple emails exist, use the first email and append any remaining emails to crm_note.
4. country_code: Country calling code (e.g., '+91' or '+1'). If it can be parsed from the phone field, put it here, otherwise default to '+91' if the country is India or leave it blank if unknown.
5. mobile_without_country_code: Mobile number without the country code. If multiple numbers exist, use the first mobile and append remaining numbers to crm_note.
6. company: Company name.
7. city: City name.
8. state: State name.
9. country: Country name.
10. lead_owner: Lead owner email or name.
11. crm_status: Lead status. Must be exactly one of these (case-sensitive):
    * GOOD_LEAD_FOLLOW_UP
    * DID_NOT_CONNECT
    * BAD_LEAD
    * SALE_DONE
    If the status is not clear, map to GOOD_LEAD_FOLLOW_UP as default.
12. crm_note: Use this for remarks, follow-up notes, additional comments, extra phone numbers, extra email addresses, and any other useful info that doesn't fit another field.
13. data_source: Source of the lead. Must be exactly one of these values (case-sensitive) or left blank/null:
    * leads_on_demand
    * meridian_tower
    * eden_park
    * varah_swamy
    * sarjapur_plots
14. possession_time: Property possession timeline (e.g. "ready to move", "Dec 2026").
15. description: Additional description or notes.

VALIDATION / SKIPPING RULE:
If a record contains NEITHER an email NOR a mobile number in any columns, set 'is_skipped' to true. Otherwise, set 'is_skipped' to false.

OUTPUT FORMAT:
Provide a JSON array of objects. Each object must represent the mapped version of the corresponding input record in the exact sequence, containing all target CRM fields and the boolean 'is_skipped' flag.
Ensure all keys are present:
{
  "created_at": string | null,
  "name": string | null,
  "email": string | null,
  "country_code": string | null,
  "mobile_without_country_code": string | null,
  "company": string | null,
  "city": string | null,
  "state": string | null,
  "country": string | null,
  "lead_owner": string | null,
  "crm_status": "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE",
  "crm_note": string | null,
  "data_source": "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | null,
  "possession_time": string | null,
  "description": string | null,
  "is_skipped": boolean
}
Ensure there are no markdown backticks or explanations outside the JSON array. Output ONLY valid JSON.`;

    if (this.provider === 'gemini') {
      return this.processWithGemini(systemPrompt);
    } else {
      return this.processWithOpenAI(systemPrompt);
    }
  }

  async processWithGemini(prompt) {
    try {
      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      return this.parseJSONResponse(text);
    } catch (err) {
      console.error('Gemini API Error:', err.message);
      throw err;
    }
  }

  async processWithOpenAI(prompt) {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a precise data conversion assistant.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('Empty response from OpenAI API');
      }

      return this.parseJSONResponse(text);
    } catch (err) {
      console.error('OpenAI API Error:', err.message);
      throw err;
    }
  }

  parseJSONResponse(text) {
    try {
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7, cleaned.length - 3).trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3, cleaned.length - 3).trim();
      }

      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.records && Array.isArray(parsed.records)) {
        return parsed.records;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      } else if (typeof parsed === 'object') {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) {
            return parsed[key];
          }
        }
      }
      throw new Error('AI output is not a JSON array');
    } catch (err) {
      console.error('Failed to parse AI JSON response. Raw text was:', text);
      throw new Error('AI response parsing failed: ' + err.message);
    }
  }

  /**
   * Local rule-based CSV processor to simulate the LLM behaviour.
   * Maps headers dynamically by checking keywords.
   */
  processMockBatch(headers, records) {
    // Normalise headers to lowercase for easy lookup
    const cleanHdr = (hdr) => hdr.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Map headers to key categories
    const headerMap = {
      created_at: headers.find(h => ['create', 'added', 'date', 'time'].some(k => cleanHdr(h).includes(k))),
      name: headers.find(h => ['name', 'full_name', 'client', 'customer', 'lead'].some(k => cleanHdr(h).includes(k))),
      email: headers.find(h => ['email', 'mail', 'addr'].some(k => cleanHdr(h).includes(k))),
      phone: headers.find(h => ['phone', 'mobile', 'contact', 'cell', 'tel', 'num'].some(k => cleanHdr(h).includes(k))),
      company: headers.find(h => ['company', 'firm', 'org', 'business', 'employer'].some(k => cleanHdr(h).includes(k))),
      city: headers.find(h => ['city', 'location', 'town'].some(k => cleanHdr(h).includes(k))),
      state: headers.find(h => ['state', 'region', 'province'].some(k => cleanHdr(h).includes(k))),
      country: headers.find(h => ['country', 'nation'].some(k => cleanHdr(h).includes(k))),
      owner: headers.find(h => ['owner', 'agent', 'assigned', 'user'].some(k => cleanHdr(h).includes(k))),
      status: headers.find(h => ['status', 'stage', 'progress'].some(k => cleanHdr(h).includes(k))),
      timeline: headers.find(h => ['timeline', 'possession', 'ready', 'time'].some(k => cleanHdr(h).includes(k))),
      description: headers.find(h => ['desc', 'detail', 'comment', 'remark', 'note'].some(k => cleanHdr(h).includes(k))),
    };

    return records.map((record) => {
      const getVal = (key) => (headerMap[key] ? record[headerMap[key]] : null);

      // 1. Process Names
      let nameVal = getVal('name');
      if (!nameVal) {
        // Fallback: check if we have first_name / last_name fields
        const first = record[headers.find(h => cleanHdr(h).includes('first'))];
        const last = record[headers.find(h => cleanHdr(h).includes('last'))];
        if (first || last) nameVal = `${first || ''} ${last || ''}`.trim();
      }

      // 2. Process Email
      let emailVal = getVal('email');
      let extraEmails = [];
      if (!emailVal) {
        // Search all fields for something that looks like an email
        for (const key of headers) {
          const val = String(record[key] || '');
          if (val.includes('@')) {
            emailVal = val;
            break;
          }
        }
      }

      if (emailVal) {
        // Handle comma/semicolon split
        const parts = String(emailVal).split(/[,;]/).map(p => p.trim());
        emailVal = parts[0];
        if (parts.length > 1) {
          extraEmails = parts.slice(1);
        }
      }

      // 3. Process Phone/Mobile
      let rawPhone = getVal('phone');
      let extraPhones = [];
      if (!rawPhone) {
        // Search for digits
        for (const key of headers) {
          if (key === headerMap.email) continue;
          const val = String(record[key] || '');
          const cleanVal = val.replace(/[^0-9]/g, '');
          if (cleanVal.length >= 10 && cleanVal.length <= 15) {
            rawPhone = val;
            break;
          }
        }
      }

      let countryCode = '+91'; // Default
      let mobileNo = null;

      if (rawPhone) {
        const cleanVal = String(rawPhone).split(/[,;]/).map(p => p.trim());
        const primaryPhone = cleanVal[0];
        if (cleanVal.length > 1) {
          extraPhones = cleanVal.slice(1);
        }

        // Clean primary phone
        const digits = primaryPhone.replace(/[^0-9+]/g, '');
        if (digits.startsWith('+')) {
          // Has country code. E.g. +919876543210
          if (digits.startsWith('+91') && digits.length === 13) {
            countryCode = '+91';
            mobileNo = digits.substring(3);
          } else if (digits.startsWith('+1') && digits.length === 12) {
            countryCode = '+1';
            mobileNo = digits.substring(2);
          } else {
            // General parser
            countryCode = digits.substring(0, 3);
            mobileNo = digits.substring(3);
          }
        } else if (digits.length === 12 && digits.startsWith('91')) {
          // Indian country code without plus sign
          countryCode = '+91';
          mobileNo = digits.substring(2);
        } else if (digits.length === 10) {
          // standard 10 digit number
          countryCode = '+91';
          mobileNo = digits;
        } else {
          mobileNo = digits;
          countryCode = '';
        }
      }

      // 4. Verification/Skip logic
      const hasEmail = emailVal && emailVal.includes('@');
      const hasPhone = mobileNo && mobileNo.length >= 7;
      const isSkipped = !(hasEmail || hasPhone);

      // 5. CRM status
      let rawStatus = getVal('status');
      let statusVal = 'GOOD_LEAD_FOLLOW_UP'; // Default

      if (rawStatus) {
        const stLower = rawStatus.toLowerCase();
        if (stLower.includes('sale') || stLower.includes('done') || stLower.includes('close') || stLower.includes('paid')) {
          statusVal = 'SALE_DONE';
        } else if (stLower.includes('did not') || stLower.includes('busy') || stLower.includes('no answer') || stLower.includes('connect')) {
          statusVal = 'DID_NOT_CONNECT';
        } else if (stLower.includes('bad') || stLower.includes('spam') || stLower.includes('not interest') || stLower.includes('junk')) {
          statusVal = 'BAD_LEAD';
        } else if (stLower.includes('good') || stLower.includes('follow') || stLower.includes('hot') || stLower.includes('warm')) {
          statusVal = 'GOOD_LEAD_FOLLOW_UP';
        }
      }

      // 6. Data Source
      const allowedSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots'];
      let sourceVal = null;
      
      // Check if source column contains any allowed value
      const rawSource = getVal('timeline') || getVal('description') || '';
      const textToSearch = (String(rawSource) + ' ' + String(record[headers.find(h => cleanHdr(h).includes('source'))] || '')).toLowerCase();
      
      for (const src of allowedSources) {
        if (textToSearch.includes(src.replace(/_/g, ' ')) || textToSearch.includes(src)) {
          sourceVal = src;
          break;
        }
      }

      // 7. Possession Time
      const possessionVal = getVal('timeline');

      // 8. CRM Note Compiler
      const notes = [];
      const rawDesc = getVal('description');
      if (rawDesc) notes.push(rawDesc);
      
      if (extraEmails.length > 0) notes.push(`Extra emails: ${extraEmails.join(', ')}`);
      if (extraPhones.length > 0) notes.push(`Extra numbers: ${extraPhones.join(', ')}`);

      const crmNoteVal = notes.join('. ');

      // 9. Created At
      let createdAtVal = getVal('created_at');
      if (createdAtVal) {
        // Try parsing
        try {
          const parsedDate = new Date(createdAtVal);
          if (!isNaN(parsedDate.getTime())) {
            // Check date validity, format as YYYY-MM-DD HH:mm:ss
            createdAtVal = parsedDate.toISOString().replace('T', ' ').substring(0, 19);
          } else {
            createdAtVal = new Date().toISOString().replace('T', ' ').substring(0, 19);
          }
        } catch {
          createdAtVal = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }
      } else {
        createdAtVal = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }

      return {
        created_at: createdAtVal,
        name: nameVal || null,
        email: emailVal || null,
        country_code: countryCode || null,
        mobile_without_country_code: mobileNo || null,
        company: getVal('company') || null,
        city: getVal('city') || null,
        state: getVal('state') || null,
        country: getVal('country') || null,
        lead_owner: getVal('owner') || null,
        crm_status: statusVal,
        crm_note: crmNoteVal || null,
        data_source: sourceVal,
        possession_time: possessionVal || null,
        description: getVal('description') || null,
        is_skipped: isSkipped
      };
    });
  }
}

export default new AIService();
