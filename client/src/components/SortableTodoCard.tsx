import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TodoCard } from "./TodoCard";
import { type Todo } from "../lib/todos";

type SortableTodoCardProps = {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; priority?: string; dueDate?: string | null }) => Promise<void>;
};

export function SortableTodoCard({ todo, onToggle, onDelete, onUpdate }: SortableTodoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : 1,
  };

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      className="p-0.5 rounded hover:bg-gray-100 transition-colors"
      title="Drag to reorder"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
      </svg>
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <TodoCard
        todo={todo}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        dragHandle={dragHandle}
      />
    </div>
  );
}
