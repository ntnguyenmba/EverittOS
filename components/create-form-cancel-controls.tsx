'use client';

/**
 * Legacy runtime enhancer. Intentionally a no-op.
 * MutationObserver DOM injection on create forms fought React controlled
 * inputs and made fields untypable. Cancel buttons belong in the React forms.
 */
export function CreateFormCancelControls() {
  return null;
}
