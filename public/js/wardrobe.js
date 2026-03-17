/**
 * wardrobe.js – Port de Wardrobe.h para LlamaGochi Web
 *
 * Sistema de sobres y guardarropa.
 */

'use strict';

const PACK_TYPES = {
  COMMON: { name:'Común',  cost:50,  desc:'3 comunes + 1 poco común' },
  RARE:   { name:'Raro',   cost:150, desc:'2 poco comunes + 1 raro'  },
  EPIC:   { name:'Épico',  cost:400, desc:'1 raro + 1 épico garantizado' },
};

// Items de ropa (tipo 3 del catálogo) + items de mobiliario (tipo 4)
const WARDROBE_ITEMS = [
  { id:9,  name:'Sombrero',     type:'clothing', slot:'hat',       rarity:1 },
  { id:10, name:'Gafas de Sol', type:'clothing', slot:'hat',       rarity:1 },
  { id:11, name:'Capa Real',    type:'clothing', slot:'accessory', rarity:2 },
  { id:12, name:'Halo Dorado',  type:'clothing', slot:'accessory', rarity:3 },
  { id:13, name:'Cama Básica',  type:'furniture',slot:'bed',       rarity:0 },
  { id:14, name:'Cama Premium', type:'furniture',slot:'bed',       rarity:1 },
  { id:15, name:'Sofá',         type:'furniture',slot:'furniture', rarity:1 },
  { id:16, name:'TV',           type:'furniture',slot:'furniture', rarity:1 },
  { id:17, name:'Planta',       type:'furniture',slot:'furniture', rarity:0 },
];

class Wardrobe {
  constructor() {}

  // ─── Abrir sobre ──────────────────────────────────────────────────────

  openPack(packType, pet) {
    const pack = PACK_TYPES[packType];
    if (!pack || pet.coins < pack.cost) return { ok: false, reason: 'Sin monedas' };

    pet.coins -= pack.cost;
    const items = this._drawItems(packType);
    items.forEach(item => {
      const existing = pet.inventory.find(e => e.id === item.id);
      if (existing) existing.qty++;
      else pet.inventory.push({ id: item.id, qty: 1 });
    });

    return { ok: true, items };
  }

  _drawItems(packType) {
    const rolls = [];
    if (packType === 'COMMON') {
      rolls.push(this._roll(0), this._roll(0), this._roll(0), this._roll(1));
    } else if (packType === 'RARE') {
      rolls.push(this._roll(1), this._roll(1), this._roll(2));
    } else if (packType === 'EPIC') {
      rolls.push(this._roll(2), this._roll(3));
    }
    return rolls;
  }

  _roll(minRarity) {
    const pool = WARDROBE_ITEMS.filter(i => i.rarity >= minRarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ─── Equipar ─────────────────────────────────────────────────────────

  equip(itemId, pet) {
    const item = WARDROBE_ITEMS.find(i => i.id === itemId);
    const entry = pet.inventory.find(e => e.id === itemId);
    if (!item || !entry || entry.qty === 0) return false;

    if (item.type === 'clothing') {
      pet.wardrobe[item.slot] = itemId;
    } else if (item.type === 'furniture') {
      if (item.slot === 'bed') {
        pet.house.bed = itemId;
      } else {
        if (pet.house.furniture_l === -1) pet.house.furniture_l = itemId;
        else pet.house.furniture_r = itemId;
      }
    }
    return true;
  }

  unequip(slot, pet) {
    if (slot in pet.wardrobe) pet.wardrobe[slot] = -1;
    if (slot === 'bed') pet.house.bed = -1;
    if (slot === 'furniture_l') pet.house.furniture_l = -1;
    if (slot === 'furniture_r') pet.house.furniture_r = -1;
  }

  // ─── Info ─────────────────────────────────────────────────────────────

  static getPackTypes() { return PACK_TYPES; }
  static getItem(id)    { return WARDROBE_ITEMS.find(i => i.id === id); }
}
