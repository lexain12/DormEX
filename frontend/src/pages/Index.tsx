import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { FeaturedCard } from '@/components/FeaturedCard';
import { TaskCard } from '@/components/TaskCard';
import { RightSidebar } from '@/components/RightSidebar';
import { CategoryChips } from '@/components/CategoryChips';
import { CreateRequestModal } from '@/components/CreateRequestModal';
import { CATEGORIES, SAMPLE_TASKS } from '@/lib/data';
import { useInteractionStore } from '@/context/interaction-store';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const { localTasks } = useInteractionStore();

  const allTasks = useMemo(() => [...localTasks, ...SAMPLE_TASKS], [localTasks]);

  const categoryParam = searchParams.get('category') ?? 'all';
  const category = CATEGORIES.some((cat) => cat.id === categoryParam) ? categoryParam : 'all';

  const filtered = category === 'all'
    ? allTasks
    : allTasks.filter((task) => task.category === category);

  const handleCategoryChange = (nextCategory: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextCategory === 'all') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', nextCategory);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const featuredTask = filtered[0] ?? allTasks[0];

  return (
    <div className="min-h-screen bg-background">
      <TopNav onCreateRequest={() => setCreateOpen(true)} />

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Main */}
          <div className="flex-1 min-w-0 space-y-5">
            {featuredTask && <FeaturedCard task={featuredTask} />}

            <CategoryChips active={category} onChange={handleCategoryChange} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.slice(1).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <RightSidebar tasks={allTasks} />
        </div>
      </div>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default Index;
