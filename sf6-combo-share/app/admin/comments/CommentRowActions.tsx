import Link from "next/link";

export default function CommentRowActions(props: {
  commentId: number;
  isPublished: boolean;
  isDeleted: boolean;
  nextUrl: string; // /admin/comments?... の相対URL
}) {
  const { commentId, isPublished, isDeleted, nextUrl } = props;
  const next = encodeURIComponent(nextUrl);

  if (!commentId) return <span className="text-xs text-red-600">ID不正</span>;

  if (isDeleted) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          className="relative z-10 px-2 py-1 border rounded text-xs"
          href={`/admin/comments/restore?id=${commentId}&next=${next}`}
        >
          復元
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className="relative z-10 px-2 py-1 border rounded text-xs"
        href={`/admin/comments/publish?id=${commentId}&publish=${isPublished ? 0 : 1}&next=${next}`}
      >
        {isPublished ? "非公開" : "公開"}
      </Link>

      <Link
        className="relative z-10 px-2 py-1 border rounded text-xs"
        href={`/admin/comments/delete?id=${commentId}&next=${next}`}
      >
        削除
      </Link>
    </div>
  );
}
