// trade-requirements.js
// Shared logic for all trade requirement forms (Architect, Electrician, Structural Engineer, Surveyor)

import { supabase, getUser } from './supabase-client.js';

export function initTradeRequirementForm(tradeType) {
  const form = document.querySelector('form') || document.querySelector('[type="submit"]')?.closest('form') || document.body;
  const submitBtn = document.querySelector('button[type="submit"]');
  if (!submitBtn) return;

  // Find form fields by label text (works across all requirement pages)
  function findInputByLabel(labelText) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
        const parent = label.closest('div') || label.parentElement;
        return parent.querySelector('input, select, textarea');
      }
    }
    return null;
  }

  // Get selected service category from radio buttons
  function getServiceCategory() {
    const checked = document.querySelector('input[name="service_type"]:checked');
    if (checked) {
      const label = checked.closest('label');
      const text = label?.querySelector('.font-label')?.textContent?.trim();
      return text || '';
    }
    return '';
  }

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    const postcode = findInputByLabel('postcode')?.value || findInputByLabel('location')?.value || '';
    const budget = findInputByLabel('budget')?.value || '';
    const scope = findInputByLabel('scope')?.value || findInputByLabel('notes')?.value || '';
    const name = findInputByLabel('name')?.value || '';
    const phone = findInputByLabel('contact')?.value || findInputByLabel('phone')?.value || '';
    const serviceCategory = getServiceCategory();

    if (!postcode || !name) {
      alert('Please fill in at least your postcode and name.');
      submitBtn.textContent = 'Request Expert Consultation';
      submitBtn.disabled = false;
      return;
    }

    const { user } = await getUser();

    // 1. Create the project
    const { data: project, error: projErr } = await supabase.from('projects').insert({
      homeowner_id: user?.id || null,
      trade_type: tradeType,
      survey_type: serviceCategory,
      property_postcode: postcode,
      contact_name: name,
      contact_phone: phone,
      contact_email: user?.email || '',
      scope_notes: scope,
      budget_range: budget,
      status: 'open'
    }).select().single();

    if (projErr) {
      alert('Error: ' + projErr.message);
      submitBtn.textContent = 'Request Expert Consultation';
      submitBtn.disabled = false;
      return;
    }

    // 2. Create detailed trade requirement
    await supabase.from('trade_requirements').insert({
      project_id: project.id,
      trade_type: tradeType,
      service_category: serviceCategory,
      budget_range: budget,
      scope_notes: scope,
      postcode: postcode,
      contact_name: name,
      contact_number: phone
    });

    // 3. Generate leads for matching suppliers
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id')
      .eq('trade_type', tradeType)
      .eq('is_active', true);

    if (suppliers && suppliers.length > 0) {
      await supabase.from('leads').insert(
        suppliers.map(s => ({ project_id: project.id, supplier_id: s.id, status: 'new' }))
      );
    }

    // 4. Redirect to quotes
    window.location.href = 'quotes.html?project=' + project.id;
  });
}
