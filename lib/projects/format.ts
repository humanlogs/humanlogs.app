/**
 * The shape of a study as the client draws it: a name and everything
 * `ProjectBadge` needs. Shared by the studies route and by the document list,
 * which now carries the study of every document it returns — including the ones
 * received through a share, whose study belongs to somebody else.
 */

export type ProjectRow = {
  id: string;
  name: string;
  iconType: string | null;
  icon: string | null;
  color: string | null;
  imageKey: string | null;
  updatedAt: Date;
};

export type ProjectDTO = {
  id: string;
  name: string;
  iconType: string | null;
  icon: string | null;
  color: string | null;
  hasImage: boolean;
  updatedAt: string;
};

export function formatProject(p: ProjectRow): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    iconType: p.iconType,
    icon: p.icon,
    color: p.color,
    hasImage: !!p.imageKey,
    updatedAt: p.updatedAt.toISOString(),
  };
}
