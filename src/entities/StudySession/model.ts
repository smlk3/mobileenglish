import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

export default class StudySession extends Model {
    static table = 'study_sessions';

    @field('deck_id') deckId!: string;
    @field('cards_studied') cardsStudied!: number;
    @field('cards_correct') cardsCorrect!: number;
    @field('duration_seconds') durationSeconds!: number;
    @field('session_type') sessionType!: 'flashcard' | 'quiz' | 'speaking';
    @field('completed_at') completedAt!: number;
    @readonly @date('created_at') createdAt!: Date;

    get accuracy(): number {
        if (this.cardsStudied === 0) return 0;
        return Math.round((this.cardsCorrect / this.cardsStudied) * 100);
    }

    get durationMinutes(): number {
        return Math.round(this.durationSeconds / 60);
    }
}
