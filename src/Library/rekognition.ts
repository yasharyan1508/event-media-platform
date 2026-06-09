import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  ResourceAlreadyExistsException,
} from "@aws-sdk/client-rekognition";
import { REKOGNITION_THRESHOLDS, REKOGNITION_SEARCH_LIMITS } from "../Constants/rekognition";

// Initialize Rekognition client
const rekognition = new RekognitionClient({
  region: process.env.REKOGNITION_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID!;

if (!COLLECTION_ID) {
  throw new Error("REKOGNITION_COLLECTION_ID is not configured in environment variables.");
}

export type RekognitionBoundingBox = {
  Width: number;
  Height: number;
  Left: number;
  Top: number;
};

export type IndexFaceResult = {
  faceId: string;
  confidence: number;
  boundingBox: RekognitionBoundingBox;
};

export type SearchFaceMatch = {
  faceId: string;
  similarity: number;
  confidence: number;
  boundingBox: RekognitionBoundingBox;
};

/**
 * Initializes the global AWS Rekognition collection.
 * Designed to be run by an initialization script.
 */
export async function initializeCollection(): Promise<void> {
  try {
    const command = new CreateCollectionCommand({ CollectionId: COLLECTION_ID });
    await rekognition.send(command);
    console.log(`[Rekognition] Created new collection: ${COLLECTION_ID}`);
  } catch (error) {
    if (error instanceof ResourceAlreadyExistsException) {
      console.log(`[Rekognition] Collection ${COLLECTION_ID} already exists.`);
    } else {
      throw error;
    }
  }
}

/**
 * Indexes a reference face from an S3 bucket into the collection.
 * Note: Assumes S3 bucket is in the exact same region as Rekognition.
 */
export async function indexFaceInCollection(
  s3Bucket: string,
  s3Key: string
): Promise<IndexFaceResult> {
  const command = new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: {
      S3Object: {
        Bucket: s3Bucket,
        Name: s3Key,
      },
    },
    MaxFaces: 1, // Only index the largest/most prominent face for reference
    QualityFilter: "AUTO",
  });

  const response = await rekognition.send(command);

  if (!response.FaceRecords || response.FaceRecords.length === 0) {
    throw new Error("No face detected in the reference image. Please use a clearer photo.");
  }

  const face = response.FaceRecords[0].Face;
  if (!face?.FaceId || !face?.Confidence || !face?.BoundingBox) {
    throw new Error("Invalid face record returned by AWS Rekognition.");
  }

  return {
    faceId: face.FaceId,
    confidence: face.Confidence,
    boundingBox: face.BoundingBox as RekognitionBoundingBox,
  };
}

/**
 * Searches the collection for any faces present in the provided image buffer.
 * Used during the background worker phase to map photos to known people.
 */
export async function searchFacesByImage(imageBuffer: Buffer): Promise<SearchFaceMatch[]> {
  const command = new SearchFacesByImageCommand({
    CollectionId: COLLECTION_ID,
    Image: {
      Bytes: imageBuffer,
    },
    FaceMatchThreshold: REKOGNITION_THRESHOLDS.REVIEW_STATE_MIN, // Minimum similarity threshold to accept as review state (70%)
    MaxFaces: REKOGNITION_SEARCH_LIMITS.MAX_FACES,               // Maximum faces to search per photo
  });

  try {
    const response = await rekognition.send(command);
    
    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return [];
    }

    // Map the AWS response to our clean type, filtering out missing data
    const matches: SearchFaceMatch[] = response.FaceMatches
      .filter((match) => match.Face?.FaceId && match.Similarity && match.Face?.Confidence && match.Face?.BoundingBox)
      .map((match) => ({
        faceId: match.Face!.FaceId!,
        similarity: match.Similarity!,
        confidence: match.Face!.Confidence!,
        boundingBox: match.Face!.BoundingBox as RekognitionBoundingBox,
      }));

    return matches;
  } catch (error: any) {
    // If the image has no faces at all, AWS sometimes throws InvalidParameterException
    // We swallow this specific case as "no matches"
    if (error.name === "InvalidParameterException" && error.message?.includes("faces")) {
      return [];
    }
    throw error;
  }
}

/**
 * Deletes a previously indexed face from the global collection.
 * Called when a user revokes their consent and requests face data deletion.
 */
export async function deleteFaceFromCollection(faceId: string): Promise<void> {
  const command = new DeleteFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceIds: [faceId],
  });

  await rekognition.send(command);
  console.log(`[Rekognition] Deleted face ${faceId} from collection.`);
}
