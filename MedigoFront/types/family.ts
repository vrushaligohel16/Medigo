export type FamilyRelation =
  | 'Self'
  | 'Spouse'
  | 'Parent'
  | 'Child'
  | 'Sibling'
  | 'Grandparent'
  | 'Other';

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export type FamilyMember = {
  id: string;
  name: string;
  relation: FamilyRelation;
  avatarUrl?: string;
  /** Active medicines for this member (from API) */
  activeMedicinesCount: number;
  /** Alias used by some API responses */
  medicineCount?: number;
  age?: number;
  phone?: string;
  bloodGroup?: BloodGroup;
  allergies: string[];
  chronicConditions: string[];
};

export type CreateFamilyMemberInput = {
  name: string;
  relation: FamilyRelation;
  /** Existing remote photo URL or relative /uploads path */
  avatarUrl?: string;
  /** Local device URI to upload as multipart `photo` */
  photoUri?: string;
  age?: number;
  phone?: string;
  bloodGroup?: BloodGroup;
  allergies: string[];
  chronicConditions: string[];
};
