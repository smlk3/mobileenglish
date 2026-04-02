import { Model } from '@nozbe/watermelondb';
import { children, date, field, readonly, writer } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';

export default class Deck extends Model {
    static table = 'decks';

    static associations: Associations = {
        cards: { type: 'has_many', foreignKey: 'deck_id' },
    };

    @field('name') name!: string;
    @field('description') description!: string | null;
    @field('cefr_level') cefrLevel!: string;
    @field('category') category!: string | null;
    @field('card_count') cardCount!: number;
    @field('is_active') isActive!: boolean;
    @field('target_language') targetLanguage!: string;
    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;

    @children('cards') cards: any;

    @writer async updateDeck(updates: {
        name?: string;
        description?: string;
        cefrLevel?: string;
        category?: string;
        isActive?: boolean;
    }) {
        await this.update((deck) => {
            if (updates.name !== undefined) deck.name = updates.name;
            if (updates.description !== undefined) deck.description = updates.description;
            if (updates.cefrLevel !== undefined) deck.cefrLevel = updates.cefrLevel;
            if (updates.category !== undefined) deck.category = updates.category;
            if (updates.isActive !== undefined) deck.isActive = updates.isActive;
        });
    }

    @writer async incrementCardCount() {
        await this.update((deck) => {
            deck.cardCount += 1;
        });
    }

    @writer async decrementCardCount() {
        await this.update((deck) => {
            deck.cardCount = Math.max(0, deck.cardCount - 1);
        });
    }

    @writer async markAsDeleted() {
        await this.destroyPermanently();
    }
}
