import { useState } from 'react';
import { EditableComment } from '../day-tracker/EditableComment';

interface DescriptionAndCommentProps {
  description: string | null;
  comment: string | null;
  onSaveDescription: (value: string | null) => void;
  onSaveComment: (value: string | null) => void;
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof EditableComment>) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="w-16 shrink-0 text-left text-[10px] lowercase tracking-wide text-gray-500 select-none">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <EditableComment {...props} />
      </div>
    </div>
  );
}

/**
 * The two text fields every todo and task carries: what you set out to do, and
 * how it actually went. One arrow opens both, and they start closed to keep
 * rows short. Shared so a todo reads the same on the tracker, the manage list
 * and a project page.
 */
export function DescriptionAndComment({
  description,
  comment,
  onSaveDescription,
  onSaveComment,
}: DescriptionAndCommentProps) {
  const [open, setOpen] = useState(false);
  const hasContent = !!description?.trim() || !!comment?.trim();

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        // Darker once either field has something in it, so a closed row still
        // shows there's writing tucked away inside.
        className={`block text-left text-[10px] lowercase tracking-wide select-none hover:text-gray-700 ${
          hasContent ? 'text-gray-600 font-medium' : 'text-gray-500'
        }`}
        title={open ? 'Hide description and comment' : 'Show description and comment'}
      >
        {open ? '▾' : '▸'} desc / comment
      </button>
      {open && (
        <>
          <Field
            label="desc"
            value={description}
            onSave={onSaveDescription}
            placeholder="What to do, notes on how, or #tag,"
            emptyLabel="Add description..."
            editTitle="Click to edit description"
          />
          <Field
            label="comment"
            value={comment}
            onSave={onSaveComment}
            placeholder="How did it go? or #tag,"
            emptyLabel="Add comment..."
            editTitle="Click to edit comment"
          />
        </>
      )}
    </div>
  );
}
