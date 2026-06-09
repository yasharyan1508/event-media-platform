export type RawAiTag = {
  label: string;
  confidence: number;
};

export function cleanAiTags(tags: RawAiTag[]): RawAiTag[] {
  const tagMap = new Map<string, number>();

  for (const tag of tags) {
    // Normalize
    const normalizedLabel = tag.label.trim().toLowerCase();
    
    if (!normalizedLabel) continue;

    // Keep highest confidence
    const existingConfidence = tagMap.get(normalizedLabel);
    if (existingConfidence === undefined || tag.confidence > existingConfidence) {
      tagMap.set(normalizedLabel, tag.confidence);
    }
  }

  // Convert back to array
  return Array.from(tagMap.entries()).map(([label, confidence]) => ({
    label,
    confidence
  }));
}
