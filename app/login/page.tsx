import { login } from './action'

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams
  
  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
      <h1>Sign In to AI Agent</h1>
      <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label htmlFor="email">Email:</label>
        <input id="email" name="email" type="email" required style={{ padding: '8px' }} />
        
        <label htmlFor="password">Password:</label>
        <input id="password" name="password" type="password" required style={{ padding: '8px' }} />
        
        {searchParams.error && (
          <p style={{ color: 'red', fontSize: '14px' }}>{searchParams.error}</p>
        )}
        
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}>
          Log In
        </button>
      </form>
    </div>
  )
}