import { Role } from "@prisma/client";

export enum Permission {
  // Event
  EVENT_CREATE = "EVENT_CREATE",
  EVENT_READ = "EVENT_READ",
  EVENT_UPDATE = "EVENT_UPDATE",
  EVENT_DELETE = "EVENT_DELETE",
  EVENT_PUBLISH = "EVENT_PUBLISH",
  EVENT_INVITE_COLLABORATOR = "EVENT_INVITE_COLLABORATOR",

  // Album
  ALBUM_CREATE = "ALBUM_CREATE",
  ALBUM_READ = "ALBUM_READ",
  ALBUM_UPDATE = "ALBUM_UPDATE",
  ALBUM_DELETE = "ALBUM_DELETE",

  // Media
  MEDIA_UPLOAD = "MEDIA_UPLOAD",
  MEDIA_READ = "MEDIA_READ",
  MEDIA_DELETE = "MEDIA_DELETE",
  MEDIA_DOWNLOAD_ORIGINAL = "MEDIA_DOWNLOAD_ORIGINAL",
  MEDIA_BULK_UPLOAD = "MEDIA_BULK_UPLOAD",

  // AI & Face
  FACE_INDEX_CREATE = "FACE_INDEX_CREATE",
  FACE_INDEX_DELETE = "FACE_INDEX_DELETE",
  FACE_SEARCH = "FACE_SEARCH",
  AI_TAG = "AI_TAG",

  // Social
  SOCIAL_LIKE = "SOCIAL_LIKE",
  SOCIAL_COMMENT = "SOCIAL_COMMENT",
  SOCIAL_FAVORITE = "SOCIAL_FAVORITE",

  // Admin
  USER_LIST = "USER_LIST",
  USER_UPDATE_ROLE = "USER_UPDATE_ROLE",
  USER_DEACTIVATE = "USER_DEACTIVATE",
  AUDIT_LOG_READ = "AUDIT_LOG_READ",
  SYSTEM_SETTINGS = "SYSTEM_SETTINGS",
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission), // Admin gets everything
  
  [Role.PHOTOGRAPHER]: [
    Permission.EVENT_READ,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,       // ^collab
    Permission.ALBUM_READ,
    Permission.ALBUM_CREATE,       // ^collab
    Permission.ALBUM_UPDATE,       // ^collab
    Permission.MEDIA_READ,
    Permission.MEDIA_UPLOAD,       // ^collab
    Permission.MEDIA_DELETE,       // ^own
    Permission.MEDIA_DOWNLOAD_ORIGINAL,
    Permission.MEDIA_BULK_UPLOAD,  // ^collab
    Permission.FACE_INDEX_CREATE,
    Permission.FACE_INDEX_DELETE,  // ^own
    Permission.FACE_SEARCH,
    Permission.AI_TAG,             // ^collab
    Permission.SOCIAL_LIKE,
    Permission.SOCIAL_COMMENT,
    Permission.SOCIAL_FAVORITE,
  ],
  
  [Role.MEMBER]: [
    Permission.EVENT_READ,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,       // ^own
    Permission.EVENT_DELETE,       // ^own
    Permission.EVENT_PUBLISH,      // ^own
    Permission.EVENT_INVITE_COLLABORATOR, // ^own
    Permission.ALBUM_READ,
    Permission.ALBUM_CREATE,       // ^own
    Permission.ALBUM_UPDATE,       // ^own
    Permission.ALBUM_DELETE,       // ^own
    Permission.MEDIA_READ,
    Permission.MEDIA_UPLOAD,       // ^own
    Permission.MEDIA_DELETE,       // ^own
    Permission.MEDIA_DOWNLOAD_ORIGINAL,
    Permission.FACE_SEARCH,
    Permission.SOCIAL_LIKE,
    Permission.SOCIAL_COMMENT,
    Permission.SOCIAL_FAVORITE,
  ],
  
  [Role.VIEWER]: [
    Permission.EVENT_READ,
    Permission.ALBUM_READ,
    Permission.MEDIA_READ,
  ],
};
