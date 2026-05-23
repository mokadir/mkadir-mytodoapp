import { useState, useRef, useEffect } from "react";
import { type Todo } from "../lib/todos";

type TodoCardProps = {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; priority?: string; dueDate?: string | null }) => Promise<void>;
  dragHandle?: React.ReactNode;
};

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-red-100 text-red-700 border-red-200",
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function TodoCard({ todo, onToggle, onDelete, onUpdate, dragHandle }: TodoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (todo.completed) return;
    setEditTitle(todo.title);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(todo.title);
  };

  const handleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === todo.title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(todo.id, { title: trimmed });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`group bg-white dark:bg-gray-800 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md ${
        todo.completed ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Drag Handle */}
        {dragHandle && (
          <div className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors">
            {dragHandle}
          </div>
        )}

        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo.id, !todo.completed)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-200 ${
            todo.completed
              ? "bg-green-500 border-green-500"
              : "border-gray-300 hover:border-blue-400"
          }`}
        >
          {todo.completed && (
            <svg
              className="w-full h-full text-white p-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Inline Editable Title */}
            {isEditing ? (
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-0"
                />
                {isSaving && (
                  <svg className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>
            ) : (
              <h3
                onClick={handleStartEdit}
                className={`text-sm font-medium transition-all duration-200 cursor-pointer hover:text-blue-600 ${
                  todo.completed
                    ? "line-through text-gray-400 dark:text-gray-500"
                    : "text-gray-900 dark:text-white"
                }`}
                title={todo.completed ? "" : "Click to edit"}
              >
                {todo.title}
              </h3>
            )}

            {/* Priority Badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[todo.priority]}`}
            >
              {priorityLabels[todo.priority]}
            </span>
          </div>

          {/* Tags */}
          {todo.tags && todo.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {todo.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                    borderColor: tag.color + "40",
                    borderWidth: 1,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Due Date */}
          {todo.dueDate && (
            <p
              className={`mt-1 text-xs flex items-center gap-1 ${
                !todo.completed && isOverdue(todo.dueDate)
                  ? "text-red-500 font-medium"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isOverdue(todo.dueDate) && !todo.completed ? "Overdue: " : "Due: "}
              {formatDate(todo.dueDate)}
            </p>
          )}
        </div>

        {/* Delete Button - always visible on mobile, hover on desktop */}
        <button
          onClick={() => onDelete(todo.id)}
          className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
          title="Delete todo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
