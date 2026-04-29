import { Service } from 'typedi';
import { StudySessionRepository } from '../repositories/studySession.repository';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Service()
export class StudyInsightsService {
  constructor(private readonly studySessionRepository: StudySessionRepository) {}

  public async getInsights(studentId: string): Promise<{
    todayMinutes: number;
    dayStreak: number;
    thisWeekMinutes: number;
    weekGraph: { day: string; hours: number }[];
    recentSessions: {
      id: string;
      startTime: string;
      endTime: string;
      studyDuration: number;
      durationMinutes: number;
      notes: string | null;
      date: string;
    }[];
  }> {
    const sessions = await this.studySessionRepository.findByStudent(studentId);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Today minutes
    const todayMinutes = sessions
      .filter(s => new Date(s.createdAt).toISOString().split('T')[0] === todayStr)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    // Day streak
    const dayStreak = this.calculateDayStreak(sessions);

    // This week minutes + graph
    const { thisWeekMinutes, weekGraph } = this.calculateWeekData(sessions, today);

    // Recent 5 sessions
    const recentSessions = sessions.slice(0, 5).map(s => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      studyDuration: s.studyDuration,
      durationMinutes: s.durationMinutes,
      notes: s.notes,
      date: new Date(s.createdAt).toISOString().split('T')[0],
    }));

    return { todayMinutes, dayStreak, thisWeekMinutes, weekGraph, recentSessions };
  }

  private calculateWeekData(
    sessions: any[],
    today: Date,
  ): { thisWeekMinutes: number; weekGraph: { day: string; hours: number }[] } {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    const weekGraph: { day: string; hours: number }[] = [];
    let thisWeekMinutes = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayMinutes = sessions
        .filter(s => new Date(s.createdAt).toISOString().split('T')[0] === dateStr)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      thisWeekMinutes += dayMinutes;
      weekGraph.push({
        day: WEEK_DAYS[date.getDay()],
        hours: Math.round((dayMinutes / 60) * 10) / 10,
      });
    }

    return { thisWeekMinutes, weekGraph };
  }

  private calculateDayStreak(sessions: any[]): number {
    if (sessions.length === 0) return 0;
    const studyDays = new Set(sessions.map(s => new Date(s.createdAt).toISOString().split('T')[0]));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (studyDays.has(dateStr)) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }
}
