// ============================================================
// Checktrades — Supabase Connection
// ============================================================
// Add this file to your GitHub repo root, then include it
// in every HTML page AFTER the Supabase CDN script:
//
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-config.js"></script>
// ============================================================

// ⚠️  REPLACE these with your real values from:
//     Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://xxdkchgizvpdwjszwfby.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // paste your anon key

// Initialise the client (available globally as `supabase`)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ============================================================
// AUTH HELPERS
// ============================================================

async function signUp(email, password, fullName, role = 'homeowner') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}


// ============================================================
// SUPPLIER QUERIES
// ============================================================

async function getSuppliersByTrade(tradeType, postcode = null) {
  let query = supabase
    .from('suppliers')
    .select(`
      *,
      supplier_postcodes (postcode_prefix)
    `)
    .eq('trade_type', tradeType)
    .eq('is_active', true)
    .order('rating_avg', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // If postcode provided, filter to matching coverage areas
  if (postcode && data) {
    const prefix = postcode.split(' ')[0].toUpperCase();
    return data.filter(s =>
      s.postcode_coverage?.includes(prefix) ||
      s.supplier_postcodes?.some(p => p.postcode_prefix === prefix) ||
      s.primary_postcode?.toUpperCase().startsWith(prefix.substring(0, 2))
    );
  }
  return data;
}

async function getSupplierById(supplierId) {
  const { data, error } = await supabase
    .from('suppliers')
    .select(`
      *,
      reviews (
        overall_rating,
        quality_rating,
        communication_rating,
        value_rating,
        narrative,
        created_at,
        profiles:reviewer_id (full_name)
      ),
      supplier_files (file_type, storage_path, file_name),
      supplier_postcodes (postcode_prefix)
    `)
    .eq('id', supplierId)
    .single();
  if (error) throw error;
  return data;
}

async function registerSupplier(supplierData) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([supplierData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateSupplier(supplierId, updates) {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', supplierId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ============================================================
// PROJECT / LEAD SUBMISSION (homeowner submits requirements)
// ============================================================

async function submitProject(projectData) {
  // 1. Create the project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert([{
      trade_type: projectData.trade_type,
      survey_type: projectData.survey_type || null,
      property_postcode: projectData.property_postcode,
      property_type: projectData.property_type || null,
      bedrooms: projectData.bedrooms || null,
      contact_name: projectData.contact_name,
      contact_phone: projectData.contact_phone || null,
      contact_email: projectData.contact_email,
      scope_notes: projectData.scope_notes || null,
      budget_range: projectData.budget_range || null,
      status: 'open'
    }])
    .select()
    .single();

  if (projectError) throw projectError;

  // 2. Save trade-specific requirements
  if (projectData.service_category || projectData.scope_notes) {
    await supabase
      .from('trade_requirements')
      .insert([{
        project_id: project.id,
        trade_type: projectData.trade_type,
        service_category: projectData.service_category || null,
        budget_range: projectData.budget_range || null,
        scope_notes: projectData.scope_notes || null,
        postcode: projectData.property_postcode,
        contact_name: projectData.contact_name,
        contact_number: projectData.contact_phone || null
      }]);
  }

  // 3. Create lead for auto-matching
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert([{
      project_id: project.id,
      status: 'new'
    }])
    .select()
    .single();

  if (leadError) throw leadError;

  return { project, lead };
}


// ============================================================
// QUOTES (supplier sends quote to homeowner)
// ============================================================

async function submitQuote(quoteData) {
  const { data, error } = await supabase
    .from('quotes')
    .insert([{
      project_id: quoteData.project_id,
      supplier_id: quoteData.supplier_id,
      price_min: quoteData.price_min,
      price_max: quoteData.price_max,
      message: quoteData.message || null,
      status: 'pending'
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getQuotesForProject(projectId) {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      suppliers (company_name, trade_type, rating_avg, review_count, is_verified)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}


// ============================================================
// LEADS (supplier's dashboard)
// ============================================================

async function getLeadsForSupplier(supplierId) {
  const { data, error } = await supabase
    .from('leads_matched')
    .select(`
      *,
      leads!inner (
        status,
        projects:project_id (
          trade_type,
          property_postcode,
          property_type,
          contact_name,
          contact_email,
          contact_phone,
          scope_notes,
          budget_range,
          created_at
        )
      )
    `)
    .eq('supplier_id', supplierId)
    .order('matched_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function respondToLead(matchId, accepted, declineReason = null) {
  const updates = accepted
    ? { status: 'accepted', accepted_at: new Date().toISOString() }
    : { status: 'declined', declined_at: new Date().toISOString(), decline_reason: declineReason };

  const { data, error } = await supabase
    .from('leads_matched')
    .update(updates)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ============================================================
// REVIEWS
// ============================================================

async function submitReview(reviewData) {
  const { data, error } = await supabase
    .from('reviews')
    .insert([{
      supplier_id: reviewData.supplier_id,
      reviewer_id: reviewData.reviewer_id || null,
      project_id: reviewData.project_id || null,
      overall_rating: reviewData.overall_rating,
      quality_rating: reviewData.quality_rating || null,
      communication_rating: reviewData.communication_rating || null,
      value_rating: reviewData.value_rating || null,
      narrative: reviewData.narrative || null
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getReviewsForSupplier(supplierId) {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      profiles:reviewer_id (full_name)
    `)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}


// ============================================================
// UI HELPERS
// ============================================================

function renderStars(rating, maxStars = 5) {
  let html = '';
  for (let i = 1; i <= maxStars; i++) {
    if (i <= Math.floor(rating)) {
      html += '<span class="material-symbols-outlined text-amber-500" style="font-variation-settings: \'FILL\' 1">star</span>';
    } else if (i - 0.5 <= rating) {
      html += '<span class="material-symbols-outlined text-amber-500" style="font-variation-settings: \'FILL\' 1">star_half</span>';
    } else {
      html += '<span class="material-symbols-outlined text-slate-300">star</span>';
    }
  }
  return html;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  toast.className = `fixed bottom-6 right-6 ${bg} text-white px-6 py-3 rounded-lg shadow-lg z-[9999] transition-opacity duration-300`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function setLoading(button, loading) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;
    button.style.opacity = '0.6';
  } else {
    button.textContent = button.dataset.originalText || 'Submit';
    button.disabled = false;
    button.style.opacity = '1';
  }
}


// ============================================================
// AUTH STATE — update nav on every page
// ============================================================

async function updateNavForAuth() {
  const user = await getCurrentUser();
  const signUpBtn = document.querySelector('[data-auth="signup-btn"]');
  const authMenu = document.querySelector('[data-auth="user-menu"]');

  if (user && signUpBtn) {
    const profile = await getProfile(user.id);
    signUpBtn.style.display = 'none';
    if (authMenu) {
      authMenu.style.display = 'flex';
      const nameEl = authMenu.querySelector('[data-auth="user-name"]');
      if (nameEl) nameEl.textContent = profile?.full_name || user.email;
    }
  }
}

// Run on every page load
document.addEventListener('DOMContentLoaded', updateNavForAuth);
