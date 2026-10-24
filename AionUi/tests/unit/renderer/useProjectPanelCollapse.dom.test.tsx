/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectPanelMode } from '@/renderer/pages/conversation/utils/layoutCalc';
import { useProjectPanelCollapse } from '@/renderer/hooks/ui/useProjectPanelCollapse';
import {
  WORKSPACE_STATE_EVENT,
  WORKSPACE_TOGGLE_EVENT,
  type WorkspaceStateDetail,
} from '@/renderer/utils/workspace/workspaceEvents';

const fireToggle = () => {
  act(() => {
    window.dispatchEvent(new CustomEvent(WORKSPACE_TOGGLE_EVENT, { cancelable: true }));
  });
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useProjectPanelCollapse (P3 host collapse)', () => {
  it('desktop defaults to expanded and toggles + persists per project', () => {
    const { result } = renderHook(() => useProjectPanelCollapse({ projectId: 'p1', isMobile: false, active: true }));
    expect(result.current.collapsed).toBe(false);
    fireToggle();
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem('project-panel-collapse:p1')).toBe('collapsed');
    fireToggle();
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem('project-panel-collapse:p1')).toBe('expanded');
  });

  it('restores the persisted per-project preference on mount', () => {
    localStorage.setItem('project-panel-collapse:p2', 'collapsed');
    const { result } = renderHook(() => useProjectPanelCollapse({ projectId: 'p2', isMobile: false, active: true }));
    expect(result.current.collapsed).toBe(true);
  });

  it('re-reads the preference when the project changes (switch away and back)', () => {
    localStorage.setItem('project-panel-collapse:pA', 'collapsed'); // pA collapsed
    // pB has no pref → expanded
    const { result, rerender } = renderHook(
      ({ id }) => useProjectPanelCollapse({ projectId: id, isMobile: false, active: true }),
      {
        initialProps: { id: 'pA' },
      }
    );
    expect(result.current.collapsed).toBe(true); // pA restored collapsed
    rerender({ id: 'pB' });
    expect(result.current.collapsed).toBe(false); // pB default expanded
    rerender({ id: 'pA' });
    expect(result.current.collapsed).toBe(true); // pA restored again
  });

  it('mobile starts collapsed and does not persist', () => {
    const { result } = renderHook(() => useProjectPanelCollapse({ projectId: 'p3', isMobile: true, active: true }));
    expect(result.current.collapsed).toBe(true);
    fireToggle(); // open the overlay
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem('project-panel-collapse:p3')).toBeNull(); // mobile is ephemeral
  });

  it('ignores the toggle when not active (non-project conversation → ChatLayout owns it)', () => {
    const { result } = renderHook(() => useProjectPanelCollapse({ projectId: null, isMobile: false, active: false }));
    fireToggle();
    expect(result.current.collapsed).toBe(false); // unchanged
  });

  it('broadcasts WORKSPACE_STATE_EVENT so the mac Titlebar icon syncs', () => {
    const states: boolean[] = [];
    const listener = (e: Event) => states.push((e as CustomEvent<WorkspaceStateDetail>).detail.collapsed);
    window.addEventListener(WORKSPACE_STATE_EVENT, listener);
    const { unmount } = renderHook(() => useProjectPanelCollapse({ projectId: 'p4', isMobile: false, active: true }));
    fireToggle();
    window.removeEventListener(WORKSPACE_STATE_EVENT, listener);
    unmount();
    // Initial broadcast (expanded=false) + after toggle (collapsed=true).
    expect(states).toContain(true);
  });
});

describe('project panel space in the glass shell', () => {
  it.each([
    [1000, false, true, false, false],
    [944, false, true, false, false],
    [943, false, true, true, false],
    [724, false, true, true, false],
    [723, false, true, true, true],
    [580, false, false, false, false],
    [579, false, false, true, false],
    [0, false, true, false, false],
    [420, true, true, true, false],
  ])('width %i mobile %s preview %s keeps controls accessible', (width, mobile, preview, overlay, full) => {
    expect(getProjectPanelMode(width as number, mobile as boolean, preview as boolean)).toEqual({
      explorerOverlay: overlay,
      previewFillsRow: full,
    });
  });

  it('temporarily uses an overlay without overwriting the desktop explorer preference', () => {
    localStorage.setItem('project-panel-collapse:responsive', 'expanded');
    const { result, rerender } = renderHook(
      ({ width }) =>
        useProjectPanelCollapse({
          projectId: 'responsive',
          isMobile: getProjectPanelMode(width, false, true).explorerOverlay,
          active: true,
        }),
      { initialProps: { width: 1000 } }
    );
    expect(result.current.collapsed).toBe(false);
    rerender({ width: 850 });
    expect(result.current.collapsed).toBe(true);
    fireToggle();
    expect(result.current.collapsed).toBe(false);
    fireToggle();
    expect(localStorage.getItem('project-panel-collapse:responsive')).toBe('expanded');
    rerender({ width: 1000 });
    expect(result.current.collapsed).toBe(false);
  });
});
