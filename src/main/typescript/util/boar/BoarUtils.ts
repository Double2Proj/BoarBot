import {RarityConfig} from '../../bot/config/items/RarityConfig';
import {BoarItemConfigs} from '../../bot/config/items/BoarItemConfigs';
import {BotConfig} from '../../bot/config/BotConfig';
import {ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
import {LogDebug} from '../logging/LogDebug';
import {GuildData} from '../data/GuildData';

/**
 * {@link BoarUtils BoarUtils.ts}
 *
 * Functions used specifically for boar functionality.
 *
 * @license {@link http://www.apache.org/licenses/ Apache-2.0}
 * @copyright WeslayCodes 2023
 */
export class BoarUtils {
    /**
     * Finds the rarity index from a given boar ID
     *
     * @param boarID - Boar ID to get rarity for
     * @param config - Used to get rarity weights
     * @return rarity - Rarity index (0) and rarity config (1) tuple
     */
    public static findRarity(boarID: string, config: BotConfig): [number, RarityConfig] {
        const orderedRarities: RarityConfig[] = [...config.rarityConfigs]
            .sort((rarity1, rarity2) => { return rarity2.weight - rarity1.weight; });

        for (let i=0; i<orderedRarities.length; i++) {
            const boarExists: boolean = orderedRarities[i].boars.includes(boarID);

            if (!boarExists) continue;

            return [i + 1, orderedRarities[i]];
        }

        return [0, orderedRarities[orderedRarities.length-1]]; // Shouldn't ever trigger with proper config validation
    }

    /**
     * Finds a boar that meets the requirements of the
     * guild and isn't blacklisted
     *
     * @param rarityIndex - The rarity index that's being checked
     * @param config - Used to get boar and rarity information
     * @param guildData - Used to see if a boar should be ignored
     * @private
     */
    public static findValid(rarityIndex: number, guildData: GuildData | undefined, config: BotConfig): string {
        const rarities: RarityConfig[] = config.rarityConfigs;
        const boarIDs: BoarItemConfigs = config.boarItemConfigs;
        let randomBoar: number = Math.random();

        // Stores the IDs of the current rarity being checked

        const validRarityBoars: string[] = [];

        for (const boarID of rarities[rarityIndex].boars) {
            const isBlacklisted: boolean = boarIDs[boarID].blacklisted;
            const isSB: boolean = boarIDs[boarID].isSB;

            if (isBlacklisted || (!guildData?.isSBServer && isSB))
                continue;
            validRarityBoars.push(boarID);
        }

        if (validRarityBoars.length == 0) return '';

        return validRarityBoars[Math.floor(randomBoar * validRarityBoars.length)];
    }

    /**
     * Gets the boar to give to the user
     *
     * @param config - Used to get valid boars and debug
     * @param guildData - Used to see if a boar should be ignored
     * @param inter - Used for debugging
     * @param rarityWeights - Map of weights and their indexes
     * @param extra - Whether to apply extra boar chance
     * @param extraVal - User's chance of extra boar
     * @private
     */
    public static getRandBoars(
        guildData: GuildData | undefined,
        inter: ChatInputCommandInteraction | MessageComponentInteraction,
        rarityWeights: Map<number, number>,
        extra: boolean,
        extraVal: number,
        config: BotConfig
    ): string[] {
        const boarIDs: string[] = [];
        let numBoars: number = 1;

        // Sorts from the lowest weight to the highest weight
        rarityWeights = new Map([...rarityWeights.entries()].sort((a, b) => { return a[1] - b[1]; }));
        const weightTotal: number = [...rarityWeights.values()].reduce((curSum, weight) => curSum + weight);

        // Sets probabilities by adding the previous probability to the current probability

        let prevProb: number = 0;
        const probabilities: Map<number, number> = new Map([...rarityWeights.entries()].map((val) => {
            const prob: [number, number] = [val[0], val[1] / weightTotal + prevProb];
            prevProb = prob[1];
            return prob;
        }));

        if (extra) {
            numBoars += Math.floor(extraVal / 100);
            extraVal -= (numBoars-1) * 100;

            if (Math.random() < extraVal / 100) {
                numBoars++;
            }
        }

        for (let i=0; i<numBoars; i++) {
            const randomRarity: number = Math.random();

            // Finds the rarity that was rolled and adds a random boar from that rarity to user profile
            for (const probabilityInfo of probabilities) {
                const rarityIndex: number = probabilityInfo[0];
                const probability: number = probabilityInfo[1];

                // Goes to next probability if randomRarity is higher
                // Keeps going if it's the rarity with the highest probability
                if (randomRarity > probability && Math.max(...probabilities.values()) !== probability)
                    continue;

                const boarGotten: string = BoarUtils.findValid(rarityIndex, guildData, config);

                LogDebug.sendDebug(`Rolled boar with ID '${boarGotten}'`, config, inter);

                boarIDs.push(boarGotten);
                break;
            }
        }

        return boarIDs;
    }

    /**
     * Returns a map storing rarity weights and their indexes
     *
     * @param config - Used to get rarity information
     * @private
     */
    public static getBaseRarityWeights(config: BotConfig): Map<number, number> {
        const rarities: RarityConfig[] = config.rarityConfigs;
        const rarityWeights: Map<number, number> = new Map();

        // Gets weight of each rarity and assigns it to Map object with its index
        for (let i=0; i<rarities.length; i++) {
            let weight: number = rarities[i].weight;

            if (!rarities[i].fromDaily)
                weight = 0;

            rarityWeights.set(i, weight);
        }

        return rarityWeights;
    }
}