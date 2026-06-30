'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from '@deemlol/next-icons';
import { EventData } from '@/types/api';
import { getEventUrl } from '@/lib/events/eventUrl';

interface CalendarViewProps {
  events: EventData[];
  onEventSelect: (event: EventData) => void;
  upcomingEvents?: EventData[];
  pastEvents?: EventData[];
}

/**
 * CalendarView component
 * Displays events in a monthly calendar grid.
 * Features:
 * - Month navigation
 * - Visual indicators for past/current/future events
 * - Context menu (right click) for quick actions
 * - Responsive grid layout
 *
 * @param events - List of events to display
 * @param onEventSelect - Callback when an event is selected
 */
export default function CalendarView({ events, onEventSelect }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const router = useRouter();

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    // Adjust so the week starts on Monday
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days = [];

    // Days from previous month
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Days from next month to complete the grid
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventData[]> = {};

    events.forEach((event) => {
      event.event_dates.forEach((dateStr) => {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const dateKey = date.toDateString();
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(event);
        }
      });
    });

    return grouped;
  }, [events]);

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Function to determine if an event is past
  const isEventPast = (event: EventData) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of current day

    // An event is past if all its dates are before today
    return event.event_dates.every((dateStr) => {
      const eventDate = new Date(dateStr);
      return eventDate < now;
    });
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="bg-white rounded-lg">
      {/* Info-bulle pour la navigation */}
      <div className="border border-gray-200 p-4 mb-6">
        <p className="text-sm text-gray-700 font-ibm">
          <strong className="font-poppins font-semibold">Navigation :</strong> Clic gauche sur un
          événement pour voir les dates, clic droit pour faire une demande directement.
        </p>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Mois précédent"
        >
          <ChevronLeft size={20} />
        </button>

        <h2 className="text-xl font-poppins font-semibold capitalize">
          {formatMonthYear(currentMonth)}
        </h2>

        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Mois suivant"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Noms des jours */}
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div className="grid grid-cols-7">
        {calendarDays.map((dayData, index) => {
          const dateKey = dayData.date.toDateString();
          const dayEvents = eventsByDate[dateKey] || [];

          return (
            <div
              key={index}
              className={`min-h-[100px] p-2 border-r border-b ${
                !dayData.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
              }`}
            >
              <div className="flex flex-col h-full">
                {/* Day Number */}
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`text-sm font-medium ${
                      isToday(dayData.date)
                        ? 'bg-black text-white rounded-full w-6 h-6 flex items-center justify-center'
                        : ''
                    }`}
                  >
                    {dayData.date.getDate()}
                  </span>
                </div>

                {/* Events */}
                <div className="flex-1 space-y-1">
                  {dayEvents.slice(0, 3).map((event, eventIndex) => {
                    const isPast = isEventPast(event);
                    return (
                      <div key={`${event.id}-${eventIndex}`} className="group relative">
                        <div
                          onClick={() => onEventSelect(event)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            router.push(getEventUrl(event));
                          }}
                          className={`text-xs px-2 py-1 cursor-pointer transition-all truncate ${
                            isPast
                              ? 'bg-gray-100 border border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-200 opacity-70'
                              : 'bg-white border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50'
                          }`}
                          title={`${event.title} - Clic gauche: voir dates, Clic droit: faire une demande${isPast ? ' (Événement passé)' : ''}`}
                        >
                          <span className="font-medium">{event.title}</span>
                        </div>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div
                      className={`text-xs text-center cursor-pointer transition-colors py-1 ${
                        dayEvents.some((event) => !isEventPast(event))
                          ? 'text-gray-600 hover:text-black'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      onClick={() => dayEvents.length > 0 && onEventSelect(dayEvents[0])}
                      title="Cliquer pour voir tous les événements de cette journée"
                    >
                      +{dayEvents.length - 3} autres
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
