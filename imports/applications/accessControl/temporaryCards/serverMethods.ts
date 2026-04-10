import { Meteor } from 'meteor/meteor';
import { TemporaryCard, TemporaryCardsCollection } from '/imports/api/temporaryCards';
import { VisitsSummaryCollection } from '/imports/api/visitSummary';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

const TemporaryCardsMethods: { [x: string]: MeteorMethod } = {
    attachTemporaryCard: async function (personId: string, cardNumber: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to attach a temporary card.');
        }

        if (!personId || !cardNumber) {
            throw new Meteor.Error('invalid-data', 'Person ID and card number are required.');
        }

        // Verify the person exists and has idInfo.cA = true
        const person = await VisitsSummaryCollection.findOneAsync({ _id: personId });
        if (!person) {
            throw new Meteor.Error('person-not-found', 'Person not found.');
        }

        if (!person.idInfo || !person.idInfo.cA) {
            throw new Meteor.Error('invalid-person', 'Person must be an Access Control member.');
        }

        // Add the card to the person's accessCard array
        const currentCards = person.idInfo.accessCard || [];
        if (currentCards.includes(cardNumber)) {
            throw new Meteor.Error('card-exists', 'This card is already attached to the person.');
        }

        await VisitsSummaryCollection.updateAsync(
            { _id: personId },
            { $push: { 'idInfo.accessCard': cardNumber } }
        );

        // Create a temporary card record
        const temporaryCard: TemporaryCard = {
            personId,
            cardNumber,
            status: 'attached',
            attachedAt: new Date(),
            attachedBy: this.userId,
        };

        return await TemporaryCardsCollection.insertAsync(temporaryCard);
    },

    removeTemporaryCard: async function (temporaryCardId: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to remove a temporary card.');
        }

        const tempCard = await TemporaryCardsCollection.findOneAsync({ _id: temporaryCardId });
        if (!tempCard) {
            throw new Meteor.Error('card-not-found', 'Temporary card not found.');
        }

        if (tempCard.status === 'removed') {
            throw new Meteor.Error('already-removed', 'This card has already been removed.');
        }

        // Remove the card from the person's accessCard array
        const person = await VisitsSummaryCollection.findOneAsync({ _id: tempCard.personId });
        if (person && person.idInfo) {
            await VisitsSummaryCollection.updateAsync(
                { _id: tempCard.personId },
                { $pull: { 'idInfo.accessCard': tempCard.cardNumber } }
            );
        }

        // Update the temporary card status
        await TemporaryCardsCollection.updateAsync(
            { _id: temporaryCardId },
            {
                $set: {
                    status: 'removed',
                    removedAt: new Date(),
                },
            }
        );
    },

    countTemporaryCards: async function (filter: { [key: string]: any } = {}): Promise<number> {
        if (!this.userId) throw new Meteor.Error('not-authorized', 'You must be logged in.');
        return await TemporaryCardsCollection.find(filter).countAsync();
    },
};

export default TemporaryCardsMethods;

// Cleanup function to be called by scheduled job
export async function cleanupExpiredTemporaryCards() {
    // console.log('Running temporary cards cleanup...');

    // Find all attached temporary cards older than 1 day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const expiredCards = await TemporaryCardsCollection.find({
        status: 'attached',
        attachedAt: { $lt: oneDayAgo },
    }).fetchAsync();

    // console.log(`Found ${expiredCards.length} expired temporary cards to remove.`);

    for (const tempCard of expiredCards) {
        try {
            // Remove the card from the person's accessCard array
            const person = await VisitsSummaryCollection.findOneAsync({ _id: tempCard.personId });
            if (person && person.idInfo) {
                const currentCards = person.idInfo.accessCard || [];
                if (currentCards.includes(tempCard.cardNumber)) {
                    await VisitsSummaryCollection.updateAsync(
                        { _id: tempCard.personId },
                        { $pull: { 'idInfo.accessCard': tempCard.cardNumber } }
                    );
                    console.log(`Removed card ${tempCard.cardNumber} from person ${tempCard.personId}`);
                }
            }

            // Update the temporary card status
            await TemporaryCardsCollection.updateAsync(
                { _id: tempCard._id },
                {
                    $set: {
                        status: 'removed',
                        removedAt: new Date(),
                    },
                }
            );
        } catch (error) {
            console.error(`Error removing temporary card ${tempCard._id}:`, error);
        }
    }

    // console.log('Temporary cards cleanup completed.');
}

