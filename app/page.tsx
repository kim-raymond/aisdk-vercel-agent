import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation'
import { Suspense} from "react";
import ChatInterface from "./ChatInterface"; 
import Instruments from "./instruments";

  interface Instrument{
    id:string,
    name:string,
    status:string,
    quantity:number,
    created_at:string,
  }
  export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser()

  // If no user exists in cookies, kick them to login
  if (!user) {
    redirect('/login')
  }

  const { data: instruments, error } = await supabase.from('instruments').select() as {data: Instrument[] | null, error: any};

  // Good practice: debug if there's an RLS or schema issue
  if (error) {
    console.error("Supabase Error:", error.message)
  }


  return (
    <div className="flex relative justify-center items-center w-full py-12 px-4 gap-4 min-h-screen font-poppins">

      <div className="absolute left-0 top-0 bg-stone-900 
      border border-stone-800 rounded-xl h-screen p-4 text-stone-50">
        <Suspense fallback={<div className="text-sm text-stone-500">Loading instruments database...</div>}>
          <Instruments instruments={instruments ?? []} />
        </Suspense>
      </div>
       {/* Passing control down cleanly to our operational client canvas layer */}
      <ChatInterface />
    </div>
  );
}