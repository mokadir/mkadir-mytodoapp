import { useState, type FormEvent } from "react";
import { type Tag } from "../lib/todos";

type AddTodoFormProps = {
  onAdd: (title: string, priority: string, dueDate: string | null, tagIds?: string[]) => Promise<void>;
  tags: Tag[];
};

export function AddTodoForm({ onAdd, tags }: AddTodoFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(title.trim(), priority, dueDate || null, selectedTagIds);
      setTitle("");
      setPriority("medium");
      setDueDate("");
      setSelectedTagIds([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 sm:p-4 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Title Input */}
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            disabled={isSubmitting}
          />
        </div>

        {/* Priority + Due Date + Submit row on mobile */}
        <div className="flex gap-2 sm:gap-3">
          {/* Priority Select */}
          <div className="flex-1 sm:w-32">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-2 sm:px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
              disabled={isSubmitting}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Due Date Input */}
          <div className="flex-1 sm:w-40">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2 sm:px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-gray-200"
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isSubmitting ? "..." : "Add"}
          </button>
        </div>
      </div>

      {/* Tags Selection */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-400 font-medium">Tags:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
                style={{
                  backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : tag.color + "20",
                  color: selectedTagIds.includes(tag.id) ? "#fff" : tag.color,
                  borderColor: tag.color + "40",
                  borderWidth: 1,
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
