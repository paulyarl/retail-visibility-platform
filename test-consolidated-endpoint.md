# Test Consolidated Endpoint

Run this curl command to test if the consolidated endpoint is working:

```bash
curl http://localhost:4000/api/directory/consolidated/baraka-international-market-inc
```

**Expected response:**
- Should return JSON with `success: true`
- Should include `listing`, `featuredProducts`, `storeTypes`, etc.
- `featuredProducts` should have 5 items

**If you get 404:**
- The route isn't mounted correctly
- Check API server startup logs for: `✅ Directory consolidated routes mounted at /api/directory`

**If you get 500:**
- There's an error in the consolidated endpoint logic
- Check API logs for error details

**If featuredProducts is empty:**
- The MV query is working but returning no results
- Run the MV refresh query again
