export type ExtractedMedicine = {
  id: string;
  name: string;
  dosage: string;
};

export type Prescription = {
  id: string;
  imageUrl: string;
  doctorName: string;
  uploadedAt: string;
  medicines: ExtractedMedicine[];
  notes?: string;
  extractedText?: string;
};

export type PrescriptionOcrResult = {
  doctorName?: string;
  medicines: ExtractedMedicine[];
};
