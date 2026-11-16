/**
 * Kitten names, coat colors and personalities. Kept in one file so they're easy
 * to tweak (project plan section 4.3). Kitten B's name is meant to be configurable -
 * change NAME_B below.
 */

export type KittenId = 'A' | 'B';

export interface KittenPersonality {
  id: KittenId;
  name: string;
  /** Base tabby coat color. */
  coat: string;
  /** Darker mackerel stripe color. */
  stripe: string;
  /** White bib / belly / paws color (used when whiteMarkings is true). */
  bib: string;
  /** True = white bib + white front paws; false = plain full tabby. */
  whiteMarkings: boolean;
  /** Pink nose. */
  nose: string;
  /** Pink inner ear. */
  innerEar: string;
  /** Eye color. */
  eye: string;
  style: 'batter' | 'zoomer';
  /** Walking speed in px per physics step. */
  walkSpeed: number;
  /** Velocity (px/step) imparted to an item when batted. */
  batStrength: number;
  /** Probability per wander decision of breaking into zoomies (used from M5). */
  zoomiesChance: number;
  /** Max jump reach in px. */
  jumpRange: number;
}

export const KITTENS: Record<KittenId, KittenPersonality> = {
  // Bargie - The Batter: reserved but mischievous when you're not looking.
  // Methodical, favors edge items, hits hard, rarely zoomies. The bicolor cat:
  // cooler gray-brown tabby with a white bib and white paws.
  A: {
    id: 'A',
    name: 'Bargie',
    coat: '#8c8172',
    stripe: '#423c34',
    bib: '#f1ede1',
    whiteMarkings: true, // white bib + white paws
    nose: '#d98f88',
    innerEar: '#e0a8a2',
    eye: '#a6c073',
    style: 'batter',
    walkSpeed: 1.6,
    batStrength: 6.5,
    zoomiesChance: 0.05,
    jumpRange: 175,
  },
  // Beano - The Zoomer: rambunctious, fast, chaotic, loves high places, weak
  // bat, frequent zoomies. The plain full tabby (no white), warmer brown.
  B: {
    id: 'B',
    name: 'Beano',
    coat: '#9c8259',
    stripe: '#4a3826',
    bib: '#f3ead6',
    whiteMarkings: false, // plain full tabby, no white
    nose: '#d98f88',
    innerEar: '#e0a8a2',
    eye: '#b7c479',
    style: 'zoomer',
    walkSpeed: 2.3,
    batStrength: 3.5,
    zoomiesChance: 0.28,
    jumpRange: 250,
  },
};
