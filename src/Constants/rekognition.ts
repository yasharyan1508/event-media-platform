export const REKOGNITION_THRESHOLDS = {
  AUTOMATIC_MATCH_MIN: 85,
  REVIEW_STATE_MIN: 70,
  // Below REVIEW_STATE_MIN (<70) is considered UNIDENTIFIED and filtered out
};

// Also define the search limits
export const REKOGNITION_SEARCH_LIMITS = {
  MAX_FACES: 10,
};
