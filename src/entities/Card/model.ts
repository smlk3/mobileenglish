import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, relation, writer } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';

export type CardStatus = 'new' | 'learning' | 'review' | 'graduated';

export default class Card extends Model {
    static table = 'cards';

    static associations: Associations = {
        decks: { type: 'belongs_to', key: 'deck_id' },
    };

    @field('deck_id') deckId!: string;
    @field('front') front!: string;
    @field('back') back!: string;
    @field('example_sentence') exampleSentence!: string | null;
    @field('pronunciation_url') pronunciationUrl!: string | null;
    @field('cefr_level') cefrLevel!: string;
    @field('category') category!: string | null;
    @field('target_language') targetLanguage!: string;

    // SRS Fields
    @field('next_review') nextReview!: number;
    @field('interval') interval!: number;
    @field('ease_factor') easeFactor!: number;
    @field('repetitions') repetitions!: number;
    @field('status') status!: CardStatus;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;

    @relation('decks', 'deck_id') deck: any;

    /** Check if the card is due for review */
    get isDue(): boolean {
        return this.nextReview <= Date.now();
    }

    /** Get the card's SRS state for algorithm input */
    get srsState() {
        return {
            interval: this.interval,
            easeFactor: this.easeFactor,
            repetitions: this.repetitions,
            status: this.status,
        };
    }

    @writer async updateSRS(srsUpdate: {
        nextReview: number;
        interval: number;
        easeFactor: number;
        repetitions: number;
        status: CardStatus;
    }) {
        await this.update((card) => {
            card.nextReview = srsUpdate.nextReview;
            card.interval = srsUpdate.interval;
            card.easeFactor = srsUpdate.easeFactor;
            card.repetitions = srsUpdate.repetitions;
            card.status = srsUpdate.status;
        });
    }

    @writer async updateContent(updates: {
        front?: string;
        back?: string;
        exampleSentence?: string;
        pronunciationUrl?: string;
    }) {
        await this.update((card) => {
            if (updates.front !== undefined) card.front = updates.front;
            if (updates.back !== undefined) card.back = updates.back;
            if (updates.exampleSentence !== undefined) card.exampleSentence = updates.exampleSentence;
            if (updates.pronunciationUrl !== undefined) card.pronunciationUrl = updates.pronunciationUrl;
        });
    }

    @writer async markAsDeleted() {
        await this.destroyPermanently();
    }
}
