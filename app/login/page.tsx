import { login } from './action'

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams
  
  return (
    <div className='relative flex flex-col items-center justify-center min-h-screen '>
      {/* background */}
    <div className="-z-1 absolute top-[18rem] w-[19rem] h-[3rem] blur-2xl mx-auto bg-radial from-sky-400 from-50% to-indigo-500">
    </div>
    <div className='flex flex-col font-poppins items-center justify-center min-h-screen gap-[2rem]'>
      <h1 className="font-bold text-[2rem]">Sign In to AI Agent</h1>
      <form action={login} className='flex flex-col text-stone-300 gap-[0.75rem] px-[2rem] w-[28rem] rounded-lg'>
        {/* <label htmlFor="email">Email:</label> */}
        <input id="email" name="email" type="email" required placeholder='Email' 
        className='border border-stone-600 outline-none bg-stone-900 px-[1.5rem] py-[1rem] rounded-full' />
        {/* <label htmlFor="password">Password:</label> */}
        <input id="password" name="password" type="password" required placeholder='Password' 
        className='border border-stone-600 outline-none bg-stone-900 px-[1.5rem] py-[1rem] rounded-full'  />
        
        {searchParams.error && (
          <p className='text-red-500 text-sm'>{searchParams.error}</p>
        )}
        
        <button type="submit" className='bg-linear-to-l from-pink-500 to-violet-500 cursor-pointer rounded-full px-[1.8rem] py-[1rem] w-max-[4rem]'>
          Log In
        </button>
      </form>
    </div>
    </div>
  )
}