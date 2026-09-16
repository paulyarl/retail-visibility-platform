/**
 * Directory entry WhatsApp capability tests (§15 / decision D5)
 *
 * The WhatsApp CTA is gated by an EXPLICIT feature key only —
 * directory_entry_flexible does NOT grant it (unlike every other
 * directory_entry section). Semantics mirror contact:
 *   mainOn && explicitWhatsappFeature && whatsapp_display !== false
 */
import { describe, it, expect } from 'vitest';
import { resolveDirectoryEntryOptions } from '../services/resolvers/DirectoryEntryOptionsResolver';

const BASE_FEATURES = {
  directory_entry_enabled: true,
  directory_entry_contact_on: true,
};

describe('resolveDirectoryEntryOptions — WhatsApp CTA gating (D5)', () => {
  it('directory_entry_whatsapp_on grants can_show_whatsapp + whatsapp_enabled', () => {
    const out = resolveDirectoryEntryOptions(
      { ...BASE_FEATURES, directory_entry_whatsapp_on: true },
      null,
    );
    expect(out.can_show_whatsapp).toBe(true);
    expect(out.whatsapp_enabled).toBe(true);
  });

  it('legacy _enabled alias grants the same flags', () => {
    const out = resolveDirectoryEntryOptions(
      { ...BASE_FEATURES, directory_entry_whatsapp_enabled: true },
      null,
    );
    expect(out.can_show_whatsapp).toBe(true);
    expect(out.whatsapp_enabled).toBe(true);
  });

  it('directory_entry_flexible does NOT grant WhatsApp (explicit key only)', () => {
    const out = resolveDirectoryEntryOptions(
      { directory_entry_enabled: true, directory_entry_flexible: true },
      null,
    );
    // Sanity: flexible DOES grant the other sections — the deviation is deliberate
    expect(out.can_show_contact).toBe(true);
    expect(out.can_show_whatsapp).toBe(false);
    expect(out.whatsapp_enabled).toBe(false);
  });

  it('flexible + explicit key → granted', () => {
    const out = resolveDirectoryEntryOptions(
      { directory_entry_enabled: true, directory_entry_flexible: true, directory_entry_whatsapp_on: true },
      null,
    );
    expect(out.can_show_whatsapp).toBe(true);
    expect(out.whatsapp_enabled).toBe(true);
  });

  it('no whatsapp key → both flags false', () => {
    const out = resolveDirectoryEntryOptions(BASE_FEATURES, null);
    expect(out.can_show_whatsapp).toBe(false);
    expect(out.whatsapp_enabled).toBe(false);
  });

  it('merchant whatsapp_display=false → whatsapp_enabled off, can_show stays on', () => {
    const out = resolveDirectoryEntryOptions(
      { ...BASE_FEATURES, directory_entry_whatsapp_on: true },
      { whatsapp_display: false },
    );
    expect(out.can_show_whatsapp).toBe(true);
    expect(out.whatsapp_enabled).toBe(false);
  });

  it('merchant whatsapp_display=null → default on', () => {
    const out = resolveDirectoryEntryOptions(
      { ...BASE_FEATURES, directory_entry_whatsapp_on: true },
      { whatsapp_display: null },
    );
    expect(out.whatsapp_enabled).toBe(true);
  });

  it('directory_entry_disabled → CTA off regardless of feature key', () => {
    const out = resolveDirectoryEntryOptions(
      { ...BASE_FEATURES, directory_entry_disabled: true, directory_entry_whatsapp_on: true },
      null,
    );
    expect(out.enabled).toBe(false);
    expect(out.can_show_whatsapp).toBe(false);
    expect(out.whatsapp_enabled).toBe(false);
  });
});
