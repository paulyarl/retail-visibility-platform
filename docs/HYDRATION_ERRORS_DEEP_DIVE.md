# React Hydration Errors - Deep Dive

**Date:** 2025-11-08  
**Focus:** Understanding and fixing React Error #310 (Hydration Mismatch)

---

## 🔍 What Are Hydration Errors?

### **The Concept**

React hydration is the process where React "attaches" to server-rendered HTML:

```
1. Server renders HTML → Sends to browser
2. Browser displays HTML (instant!)
3. React JavaScript loads
4. React "hydrates" the HTML (makes it interactive)
```

**The Problem:** If the client-side React render doesn't match the server HTML exactly, React throws Error #310.

---

## 🚨 The Errors We Encountered

### **Error #310: Hydration Mismatch**

```
Error: Minified React error #310
Text content does not match server-rendered HTML
```

**What it means:** The DOM structure React expects doesn't match what the server sent.

### **Where We Saw It**

1. **Billing Page** - "Something went wrong" red error screen
2. **Admin Layout** - Brief flash then error
3. **AppShell** - Inconsistent navigation rendering

---

## 🎯 Root Causes We Discovered

### **1. Conditional Rendering Based on Client-Only State**

**The Problem:**
```typescript
// ❌ BAD: Server doesn't know about mounted state
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Server renders: null
// Client renders: <Spinner />
// MISMATCH! 🚨
if (!mounted) {
  return <Spinner size="lg" />;
}

return <Content />;
```

**Why it fails:**
- Server: `mounted = false` → renders `null`
- Client (first render): `mounted = false` → renders `<Spinner />`
- React: "These don't match!" → Error #310

**The Fix:**
```typescript
// ✅ GOOD: Same structure on both sides
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Server renders: null
// Client renders: null (initially)
// MATCH! ✅
return mounted ? <Content /> : null;
```

### **2. usePathname() Evaluated Before Hydration**

**The Problem:**
```typescript
// ❌ BAD: pathname evaluated immediately
const pathname = usePathname();
const isActive = pathname === item.href;

// Server: pathname might be undefined or different
// Client: pathname is actual current path
// MISMATCH! 🚨

<Link className={isActive ? 'active' : 'inactive'}>
```

**Why it fails:**
- Server might not have pathname context
- Client evaluates pathname immediately
- Different className → Different DOM → Hydration error

**The Fix:**
```typescript
// ✅ GOOD: Wait for mount before checking
const pathname = usePathname();
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

const isActive = mounted && (pathname === item.href);

// Server: isActive = false (mounted = false)
// Client (first render): isActive = false (mounted = false)
// Client (after mount): isActive = true (if matches)
// MATCH on first render! ✅
```

### **3. User-Dependent Conditional Rendering**

**The Problem:**
```typescript
// ❌ BAD: User state might differ
const { user } = useAuth();

// Server: user might be null
// Client: user might be loaded from localStorage
// MISMATCH! 🚨

{user && <TenantSwitcher />}
{user ? <SignOut /> : <SignIn />}
```

**Why it fails:**
- Server doesn't have access to localStorage
- Client might load user from localStorage immediately
- Different rendering → Hydration error

**The Fix:**
```typescript
// ✅ GOOD: Wait for hydration
const { user } = useAuth();
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  setHydrated(true);
}, []);

// Only show user-dependent UI after hydration
{hydrated && user && <TenantSwitcher />}
{hydrated && user ? <SignOut /> : <SignIn />}
```

### **4. Tenant-Scoped Links Computed Client-Side**

**The Problem:**
```typescript
// ❌ BAD: Feature flags evaluated immediately
const tenantId = localStorage.getItem('tenantId');
const ffOn = isFeatureEnabled('FF_TENANT_URLS', tenantId);

// Server: tenantId = null, ffOn = false
// Client: tenantId = 'abc123', ffOn = true
// Different links → MISMATCH! 🚨

const settingsLink = ffOn ? `/t/${tenantId}/settings` : '/settings';
```

**The Fix:**
```typescript
// ✅ GOOD: Compute after hydration
const [links, setLinks] = useState({ settings: '/settings' });

useEffect(() => {
  const tenantId = localStorage.getItem('tenantId');
  const ffOn = isFeatureEnabled('FF_TENANT_URLS', tenantId);
  
  if (ffOn && tenantId) {
    setLinks({ settings: `/t/${tenantId}/settings` });
  }
}, []);

// Server: links.settings = '/settings'
// Client (first render): links.settings = '/settings'
// Client (after effect): links.settings = '/t/abc123/settings'
// MATCH on first render! ✅
```

---

## 🔧 The Solutions We Implemented

### **Pattern 1: Mounted State Guard**

```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Don't render anything until mounted
return mounted ? <Content /> : null;
```

**When to use:**
- Component has client-only logic
- Conditional rendering based on browser APIs
- User state or localStorage access

### **Pattern 2: Hydrated State for Conditional UI**

```typescript
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  setHydrated(true);
}, []);

// Render base UI, conditionally enhance after hydration
return (
  <div>
    <BaseContent />
    {hydrated && <EnhancedFeatures />}
  </div>
);
```

**When to use:**
- Progressive enhancement
- User-dependent features
- Optional UI elements

### **Pattern 3: Consistent Initial State**

```typescript
// ✅ GOOD: Same initial state on server and client
const [data, setData] = useState(null);

useEffect(() => {
  // Fetch data after mount
  fetchData().then(setData);
}, []);

// Both server and client render loading state initially
if (!data) return <Loading />;
return <Content data={data} />;
```

**When to use:**
- Data fetching
- API calls
- Dynamic content

---

## 🎨 The CSS Connection

### **Why CSS Seemed Related**

The error messages mentioned CSS:
```
Unknown pseudo-class or pseudo-element '-webkit-any'
Unknown property '-moz-osx-font-smoothing'
```

**But these were red herrings!** They were just warnings, not the cause of hydration errors.

### **The Real Issue**

The hydration errors caused the page to crash, which made the CSS warnings more visible. Once we fixed hydration, the CSS warnings remained but didn't break anything.

**CSS warnings are cosmetic:**
- Browser-specific prefixes
- Vendor-specific properties
- Safe to ignore

**Hydration errors are critical:**
- Break the entire page
- Cause "Something went wrong" screens
- Must be fixed

---

## 📊 Our Specific Cases

### **Case 1: Billing Page**

**Symptom:** Red error screen, page unusable

**Root Cause:**
```typescript
// ❌ Original code
if (!mounted) {
  return (
    <div>
      <PageHeader />
      <Spinner />  // ← Different structure from server!
    </div>
  );
}
```

**Fix:**
```typescript
// ✅ Fixed code
return mounted ? (
  <div>
    <PageHeader />
    <Content />
  </div>
) : null;  // ← Same as server (nothing)
```

**Result:** ✅ No hydration errors, page works perfectly

### **Case 2: Admin Layout**

**Symptom:** Access denied flash, then error

**Root Cause:**
```typescript
// ❌ Original code
const isActive = pathname === item.href;  // ← Evaluated before mount!

<Link className={isActive ? 'bg-blue-600' : 'text-gray-700'}>
```

**Fix:**
```typescript
// ✅ Fixed code
const isActive = mounted && (pathname === item.href);

<Link className={isActive ? 'bg-blue-600' : 'text-gray-700'}>
```

**Result:** ✅ No hydration errors, navigation works

### **Case 3: AppShell**

**Symptom:** Inconsistent user UI, occasional errors

**Root Cause:**
```typescript
// ❌ Original code
{user && <TenantSwitcher />}  // ← user might differ on server/client
{tenantScopedLinksOn ? 'Tenant Settings' : 'Settings'}  // ← computed before mount
```

**Fix:**
```typescript
// ✅ Fixed code
{hydrated && user && <TenantSwitcher />}
{hydrated && tenantScopedLinksOn ? 'Tenant Settings' : 'Settings'}
```

**Result:** ✅ No hydration errors, consistent UI

---

## 🧪 How to Debug Hydration Errors

### **Step 1: Add Logging**

```typescript
console.log('[Component] Render:', {
  mounted,
  user: !!user,
  pathname,
  // ... other state
});
```

**What to look for:**
- Different values on server vs client
- State that changes immediately after mount
- Conditional rendering based on client-only data

### **Step 2: Check the Pattern**

```typescript
// ❌ RED FLAGS:
- if (!mounted) return <DifferentStructure />
- const value = localStorage.getItem(...)  // At top level
- {user && <Component />}  // Without hydrated check
- const isActive = pathname === ...  // Without mounted check
```

### **Step 3: Apply the Fix**

```typescript
// ✅ SAFE PATTERNS:
- return mounted ? <Content /> : null
- useEffect(() => { const value = localStorage.getItem(...) }, [])
- {hydrated && user && <Component />}
- const isActive = mounted && (pathname === ...)
```

### **Step 4: Test**

1. Clear cache and cookies
2. Hard refresh (Ctrl+Shift+R)
3. Check console for errors
4. Verify page renders correctly
5. Check that interactive features work

---

## 💡 Key Insights

### **1. Server vs Client Context**

**Server has:**
- ❌ No localStorage
- ❌ No cookies (unless passed explicitly)
- ❌ No window object
- ❌ No user session (usually)

**Client has:**
- ✅ localStorage
- ✅ Cookies
- ✅ window object
- ✅ User session

**Solution:** Don't use client-only features until after mount!

### **2. First Render Must Match**

The **first client render** must produce the **exact same HTML** as the server.

```typescript
// Server render:     <div>Loading...</div>
// Client render 1:   <div>Loading...</div>  ✅ MATCH
// Client render 2:   <div>Content!</div>    ✅ OK (after hydration)
```

### **3. Progressive Enhancement**

Start with a basic version that works on server, enhance on client:

```typescript
// Server: Basic version
<div>
  <h1>Dashboard</h1>
  <p>Loading...</p>
</div>

// Client (after hydration): Enhanced version
<div>
  <h1>Dashboard</h1>
  <Stats />
  <QuickActions />
  <TenantInfo />
</div>
```

---

## 🎓 Lessons Learned

### **1. Refactoring Fixes Hydration**

**Observation:** When we refactored billing page, hydration errors disappeared.

**Why?**
- Cleaner state management
- Proper hook extraction
- Consistent rendering patterns
- Better separation of concerns

**Takeaway:** Good architecture prevents hydration issues naturally!

### **2. Mounted State is Your Friend**

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
```

This simple pattern solves 80% of hydration issues.

### **3. Test After Every Change**

Hydration errors can be introduced easily:
- Adding a new conditional render
- Using localStorage at top level
- Checking user state without hydration guard

**Always test:**
1. Hard refresh
2. Clear cache
3. Check console
4. Verify functionality

---

## 📚 Resources & References

### **Official React Docs**
- [React Hydration](https://react.dev/reference/react-dom/client/hydrateRoot)
- [Error #310](https://react.dev/errors/310)

### **Next.js Docs**
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

### **Our Examples**
- `apps/web/src/app/admin/billing/page.tsx` - Fixed hydration
- `apps/web/src/app/admin/layout.tsx` - Mounted state pattern
- `apps/web/src/components/app-shell/AppShell.tsx` - Hydrated state pattern

---

## 🔮 Future Considerations

### **1. Add Automated Checks**

```typescript
// Pre-commit hook to catch common issues
if (code.includes('if (!mounted) return <')) {
  warn('Potential hydration issue: Different structure before mount');
}
```

### **2. Create Helper Hook**

```typescript
// useHydrated.ts
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

// Usage
const hydrated = useHydrated();
return hydrated ? <Content /> : null;
```

### **3. Document Patterns**

Create a style guide with:
- ✅ Safe patterns
- ❌ Dangerous patterns
- 🔧 How to fix common issues

---

## 🎯 Summary

### **The Core Issue**
Server-rendered HTML must match client's first render exactly, or React throws hydration errors.

### **Common Causes**
1. Conditional rendering based on client-only state
2. localStorage/cookies accessed before mount
3. User state checked without hydration guard
4. Feature flags evaluated immediately

### **The Solution**
Wait for mount/hydration before using client-only features:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
return mounted ? <Content /> : null;
```

### **The Result**
✅ Zero hydration errors across all refactored pages!

---

**This was the most interesting technical challenge of the session, and solving it taught us valuable lessons about React's rendering model and Next.js hydration!** 🎓
