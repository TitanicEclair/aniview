import { AniviewConfig } from '../aniviewConfig';

describe('AniviewConfig Semantic Mapping', () => {
    const layout = [[1, 1, 1]]; // 3 pages in a row
    const pageMap = {
        'WARDROBE': 0,
        'SHELVES': 1,
        'ROOM': 2
    };
    const dims = { 
        width: 400, 
        height: 800, 
        offsetX: 0, 
        offsetY: 0
    };
    
    let config: AniviewConfig;

    beforeEach(() => {
        config = new AniviewConfig(layout, 0, pageMap, dims, {}, {});
    });

    test('resolvePageId: should resolve numeric indices directly', () => {
        expect(config.resolvePageId(0)).toBe(0);
        expect(config.resolvePageId(1)).toBe(1);
    });

    test('resolvePageId: should resolve semantic names from pageMap', () => {
        expect(config.resolvePageId('WARDROBE')).toBe(0);
        expect(config.resolvePageId('SHELVES')).toBe(1);
        expect(config.resolvePageId('ROOM')).toBe(2);
    });

    test('resolvePageId: should fallback to parseInt for unknown strings', () => {
        expect(config.resolvePageId('1')).toBe(1);
        expect(config.resolvePageId('99')).toBe(99);
        expect(config.resolvePageId('invalid')).toBe(0); // Default fallback
    });

    test('getPageOffset: should return correct coordinates for semantic names', () => {
        const wardrobeOffset = config.getPageOffset('WARDROBE', dims);
        const shelvesOffset = config.getPageOffset('SHELVES', dims);
        const roomOffset = config.getPageOffset('ROOM', dims);

        expect(wardrobeOffset).toEqual({ x: 0, y: 0 });
        expect(shelvesOffset).toEqual({ x: 400, y: 0 });
        expect(roomOffset).toEqual({ x: 800, y: 0 });
    });

    test('register: should bake frames correctly with semantic keys', () => {
        const keyframes = {
            move: { page: 'ROOM', style: { opacity: 0.5 } }
        };
        
        // Register component on SHELVES, moving to ROOM
        const bake = config.register('SHELVES', dims, keyframes);
        
        expect(bake.homeOffset).toEqual({ x: 400, y: 0 });
        expect(bake.bakedFrames['move'].worldX).toBe(400); // 800 (ROOM) - 400 (SHELVES)
        expect(bake.bakedFrames['move'].worldY).toBe(0);
    });

    test('getWorldBounds: should calculate correct limits for semantic layout', () => {
        const bounds = config.getWorldBounds(dims);
        expect(bounds.minX).toBe(0);
        expect(bounds.maxX).toBe(800);
        expect(bounds.minY).toBe(0);
        expect(bounds.maxY).toBe(0);
    });
});
