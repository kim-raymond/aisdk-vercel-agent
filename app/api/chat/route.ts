import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from 'ai';
import { createClient } from '@/lib/supabase/server';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export async function POST(req: Request) {

  // Get the current user session via cookies
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  // Block the request if not authenticated
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // ============================================================
  // PDF FIX — pre-fetch all PDF parts before converting messages
  // since convertDataPart does not support async callbacks
  // ============================================================
  type PdfData = { url: string; name: string };

  // Collect all PDF URLs across all messages
  const pdfUrls: string[] = messages.flatMap((msg: any) =>
    (msg.parts ?? [])
      .filter((p: any) => p.type === 'data-pdf')
      .map((p: any) => (p.data as PdfData).url)
  );

  console.log('Found PDF URLs in messages:', pdfUrls);
  
  // Fetch all PDFs in parallel and build a URL → base64 map
  const pdfMap = new Map<string, string>();
  await Promise.all(
    pdfUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch PDF from storage: ${url}`);
      const buffer = await res.arrayBuffer();
      pdfMap.set(url, Buffer.from(buffer).toString('base64'));
    })
  );
  // ============================================================

  const result = streamText({
    model: google('gemini-2.5-flash'),
    // PDF FIX — convertDataPart is sync, looks up pre-fetched base64
    messages: await convertToModelMessages(messages, {

      convertDataPart: (part) => {
        if (part.type === 'data-pdf') {
          const { url } = part.data as PdfData;
          const base64 = pdfMap.get(url);
          if (!base64) return undefined;
          return {
            type: 'file' as const,
            mediaType: 'application/pdf',
            data: base64,
          };
        }
      },
    }),
    // ============================================================
    system: 'You are a helpful assistant. When a PDF is provided, read and answer questions about it.',
    stopWhen: stepCountIs(5),

    tools: {
      weather: tool({
        description: 'Get the weather in a location (fahrenheit)',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => {
          const temperature = Math.round(Math.random() * (90 - 32) + 32);
          return { location, temperature };
        },
      }),
      convertFahrenheitToCelsius: tool({
        description: 'Convert a temperature in fahrenheit to celsius',
        inputSchema: z.object({
          temperature: z.number().describe('The temperature in fahrenheit to convert'),
        }),
        execute: async ({ temperature }) => {
          const celsius = Math.round((temperature - 32) * (5 / 9));
          return { celsius };
        },
      }),
      addInstrumentToDatabase: tool({
        description:'Insert new asset device to supabase database',
        inputSchema:z.object({
          name:z.string().describe('The common name of the hardware instrument'),
          status:z.enum(['operational','maintenance','broken']).describe('The operational status of the tool'),
          quantity:z.number().default(1).describe('The volume amount of units being registered'),

        }),
        execute: async ({name,status,quantity}) => {
          const supabase = await createClient();

          const { data, error} = await supabase
          .from('instruments')
          .insert([{ name, status, quantity}])
          .select()
          .single();

          if (error) {
            console.log('Database Tool Write Error:',error);
            return{success:false,error:error.message};
          }
          // revalidatePath('/');
          return{ success:true,insertedRow:data };
        },
      }),
      updateInstrumentInDatabase : tool({
        description: 'Update existing asset in the Database',
        inputSchema: z.object({
          name:z.string().describe('The name of the asset instrument to update'),
          status:z.enum(['operational','maintenance','broken']).describe('The operational status of the tool to be updated'),
          quantity:z.number().default(1).describe('The quantity of assets to update'),

      }),
        execute: async ({name,status,quantity}) => {
        const supabase = await createClient();
        const { data, error} = await supabase
        .from('instruments')
        .upsert([{ name, status, quantity}])
        .select()
        .single();

        if (error) {
            console.log('Database Tool Update Error:',error);
          return{success:false,error:error.message};
        }
        return{ success:true,upsertedRow:data };
        },
    }),
    deleteInstrumentFromDatabase: tool({
      description:'Delete or remove asset from database',
      inputSchema:z.object({
        name:z.string().describe('The name of the asset to delete from database'),
        status:z.enum(['operational','maintenance','broken']).describe('The operational status of the tool'),
        quantity:z.number().default(1).describe('The quantity of the assets to be delete'),
      }),
      execute: async ({name,status,}) =>{

        const supabase = await createClient();
        const {data,error} = await supabase
        .from('instruments')
        .delete()
        .eq('name',name)
        .eq('status',status);

        if(error){
            console.log('Database delete tool error',error)
            return({succes:true,error:error.message})
        }
        return({success:true,deletedRow:data});
      }
    }),
    }
  });

  return result.toUIMessageStreamResponse();
}