import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

export default class ChatMessage extends Model {
    static table = 'chat_messages';

    @field('role') role!: 'user' | 'assistant' | 'system';
    @field('content') content!: string;
    @field('session_id') sessionId!: string;
    @field('metadata') metadata!: string | null;
    @readonly @date('created_at') createdAt!: Date;

    get parsedMetadata(): Record<string, any> | null {
        if (!this.metadata) return null;
        try {
            return JSON.parse(this.metadata);
        } catch {
            return null;
        }
    }
}
