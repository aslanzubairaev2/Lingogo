# Frontend Migration Guide: Adding User Authentication

## 🚨 Critical Issue: Category ID Problem

**Current Error:** `Key (category_id)=(1) is not present in table "categories"`

**Cause:** Frontend tries to create phrases with old category IDs that don't exist for the new user.

**Solution:** Implement proper user data initialization and ID management.

---

## 📋 Step-by-Step Migration Instructions

### Phase 1: Setup Supabase Auth

#### 1.1 Install Supabase
```bash
npm install @supabase/supabase-js
```

#### 1.2 Create Supabase Client
```javascript
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### 1.3 Add Environment Variables
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Phase 2: Implement Authentication Flow

#### 2.1 Create Auth Context
```javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)

        if (event === 'SIGNED_IN' && session?.user) {
          await initializeUserData(session.access_token)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const initializeUserData = async (token) => {
    try {
      // Check if user has data
      const response = await fetch(`${API_BASE_URL}/initial-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (!data.categories || data.categories.length === 0) {
          // Load initial data for new user
          await fetch(`${API_BASE_URL}/initial-data`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to initialize user data:', error)
    }
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
```

#### 2.2 Add API Configuration
```javascript
// src/lib/api.js
const LOCAL_API_URL = 'http://localhost:3001/api'
const PRODUCTION_API_URL = 'https://learning-phrase-practice-back.vercel.app/api'

export const API_BASE_URL = import.meta.env.PROD
  ? PRODUCTION_API_URL
  : LOCAL_API_URL

export const apiRequest = async (endpoint, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authentication token')
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login'
    throw new Error('Authentication required')
  }

  return response
}
```

### Phase 3: Update Data Fetching

#### 3.1 Update Categories Store
```javascript
// src/stores/categories.js
import { writable } from 'svelte/store'
import { apiRequest } from '../lib/api'

export const categories = writable([])

export const loadCategories = async () => {
  try {
    const response = await apiRequest('/initial-data')
    const data = await response.json()
    categories.set(data.categories || [])
    return data.categories
  } catch (error) {
    console.error('Failed to load categories:', error)
    return []
  }
}

export const createCategory = async (categoryData) => {
  try {
    const response = await apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    })
    const newCategory = await response.json()

    categories.update(current => [...current, newCategory])
    return newCategory
  } catch (error) {
    console.error('Failed to create category:', error)
    throw error
  }
}
```

#### 3.2 Update Phrases Store
```javascript
// src/stores/phrases.js
import { writable } from 'svelte/store'
import { apiRequest } from '../lib/api'

export const phrases = writable([])

export const loadPhrases = async () => {
  try {
    const response = await apiRequest('/initial-data')
    const data = await response.json()
    phrases.set(data.phrases || [])
    return data.phrases
  } catch (error) {
    console.error('Failed to load phrases:', error)
    return []
  }
}

export const createPhrase = async (phraseData) => {
  try {
    // Ensure category_id exists and belongs to user
    const categories = await loadCategories()
    const categoryExists = categories.some(cat => cat.id === phraseData.category_id)

    if (!categoryExists) {
      throw new Error('Invalid category_id - category does not exist for this user')
    }

    const response = await apiRequest('/phrases', {
      method: 'POST',
      body: JSON.stringify(phraseData)
    })
    const newPhrase = await response.json()

    phrases.update(current => [...current, newPhrase])
    return newPhrase
  } catch (error) {
    console.error('Failed to create phrase:', error)
    throw error
  }
}
```

### Phase 4: Update Components

#### 4.1 Update App Component
```javascript
// src/App.svelte
<script>
  import { onMount } from 'svelte'
  import { AuthProvider, useAuth } from './contexts/AuthContext'
  import { loadCategories } from './stores/categories'
  import { loadPhrases } from './stores/phrases'
  import Login from './components/Login.svelte'
  import Dashboard from './components/Dashboard.svelte'

  let user = null
  let loading = true

  onMount(async () => {
    // Auth state will be handled by AuthProvider
  })

  $: if ($user && !$loading) {
    // Load user data when authenticated
    loadCategories()
    loadPhrases()
  }
</script>

<AuthProvider>
  {#if $loading}
    <div>Loading...</div>
  {:else if $user}
    <Dashboard />
  {:else}
    <Login />
  {/if}
</AuthProvider>
```

#### 4.2 Create Login Component
```javascript
// src/components/Login.svelte
<script>
  import { useAuth } from '../contexts/AuthContext'

  const { signIn, signUp } = useAuth()

  let email = ''
  let password = ''
  let isSignUp = false
  let error = ''

  const handleSubmit = async () => {
    try {
      error = ''
      const { error: authError } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password)

      if (authError) {
        error = authError.message
      }
    } catch (err) {
      error = err.message
    }
  }
</script>

<div class="login-container">
  <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <input
      type="email"
      bind:value={email}
      placeholder="Email"
      required
    />

    <input
      type="password"
      bind:value={password}
      placeholder="Password"
      required
    />

    <button type="submit">
      {isSignUp ? 'Sign Up' : 'Sign In'}
    </button>
  </form>

  <button on:click={() => isSignUp = !isSignUp}>
    {isSignUp ? 'Already have account?' : 'Need account?'}
  </button>
</div>
```

### Phase 5: Handle Data Migration

#### 5.1 Clear Old Data on Login
```javascript
// In AuthContext.jsx, after successful login
localStorage.removeItem('categories') // Clear old cached data
localStorage.removeItem('phrases')    // Clear old cached data
```

#### 5.2 Update Existing Components
- Replace all direct API calls with `apiRequest()`
- Update category/phrase creation to validate IDs
- Add loading states for data fetching
- Handle 401 errors with redirect to login

### Phase 6: Testing

#### 6.1 Test Authentication Flow
1. Sign up new user
2. Check that initial data loads
3. Create new category
4. Create phrase with valid category_id
5. Verify data persists between sessions

#### 6.2 Test Error Handling
1. Try creating phrase with invalid category_id
2. Check 401 handling when token expires
3. Verify logout clears data

---

## 🔧 Quick Fix for Current Error

If you need immediate fix, update phrase creation to validate category_id:

```javascript
const createPhrase = async (phraseData) => {
  // Get user's categories first
  const userCategories = await loadCategories()

  // Check if category exists
  const category = userCategories.find(cat => cat.id === phraseData.category_id)
  if (!category) {
    throw new Error('Category not found. Please select a valid category.')
  }

  // Proceed with creation
  const response = await apiRequest('/phrases', {
    method: 'POST',
    body: JSON.stringify(phraseData)
  })

  return response.json()
}
```

This guide provides complete migration path from unauthenticated to authenticated app! 🚀