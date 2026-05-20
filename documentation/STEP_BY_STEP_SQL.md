# 📝 Step-by-Step: Run SQL in Supabase

## 🎯 **Clear Instructions**

### **Step 1: Open Supabase SQL Editor**

1. Go to: https://app.supabase.com/
2. Click on your project
3. In the **left sidebar**, find and click: **SQL Editor**
   - Icon looks like: `</>`
4. Click the **"+"** button or **"New query"** button (top right area)

---

### **Step 2: Test SQL Editor Works**

**Copy this simple test:**
```sql
SELECT 'SQL Editor is working!' as message;
```

**Paste into the editor and click "Run"**

**You should see:**
- A result table with: "SQL Editor is working!"
- ✅ This means the editor works!

---

### **Step 3: Run the Full Schema**

Now we'll create the tables.

#### **Option A: Copy from File (Recommended)**

1. **In your code editor (VS Code/Cursor):**
   - Navigate to: `backend/src/database/schema.sql`
   - **Select ALL** (Ctrl+A)
   - **Copy** (Ctrl+C)

2. **Back in Supabase SQL Editor:**
   - Clear the editor (delete the test query)
   - **Paste** (Ctrl+V)
   - Click **"Run"** button
   - **Wait** (might take 5-10 seconds)

#### **Option B: Manual (if copy doesn't work)**

I can show you a smaller version to paste manually.

---

### **Step 4: Check for Success**

After clicking "Run", you should see **one of these**:

**✅ Success:**
```
Success. No rows returned
```
OR
```
Success. 5 rows returned
```

**❌ Error:**
- Red error message
- **Copy the error message** and send it to me

---

### **Step 5: Verify Tables Exist**

1. In Supabase, click **"Table Editor"** (left sidebar)
2. You should see **3 tables**:
   - products
   - orders  
   - contact_messages

3. Click on **"products"** - should show 5 Nike shoes

---

## 🆘 **Troubleshooting**

### "Nothing happens when I click Run"
- Make sure you pasted the SQL code
- Check if there's a loading spinner
- Try refreshing the page

### "Syntax error" or "Failed"
- Send me the exact error message
- I'll help fix it

### "I don't see SQL Editor in sidebar"
- Look for icon: `</>`
- Or try: Database → SQL Editor

---

## 📋 **Quick Checklist**

Before running:
- [ ] I'm on https://app.supabase.com/
- [ ] I selected my project
- [ ] I see "SQL Editor" in left sidebar
- [ ] I clicked it and see a text editor
- [ ] I have the schema.sql content ready to paste

---

**After you run it, tell me:**
1. Did you see "Success"? ✅
2. Or did you get an error? ❌ (send me the error)
3. Do you see tables in Table Editor? ✅

---

**Reply with what you see! 🚀**

