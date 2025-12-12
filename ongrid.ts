// NOTE: All dimensions are in world units where 1wu = 1 cell dim
// unless specified otherwise (e.g., DimPx = dim in px)
// Coordinates are top-down, left-right. 0 is the edge, not the center
// All time is in ms
type v2 = {x: number, y: number}

enum EntityKind {
    None,
    Generator,
    Motor,
    Producer,
}

type Entity = {
    kind: EntityKind,
    currentRate: number,
    cycleProgress: number,
}

type EntityHandle = {
    entity: Entity | null,
    index: number,
    pos: v2,
}

type GameState = {
    lastTimestamp: number,
    worldDim: v2,
    cursor: {pos: v2, leftButtonDown: boolean},
    entities: {
        storage: Entity[],
    },
    referenceCycleDuration: number,
    cellDimPx: number,
    gridCellBorderWidthPx: number,
}

let globalState: GameState = {
    lastTimestamp: 0,
    worldDim: {x: 10, y: 10},
    cursor: {pos: {x: 0, y: 0}, leftButtonDown: false},
    entities: {
        storage: [],
    },
    referenceCycleDuration: 1000,
    cellDimPx: 50,
    gridCellBorderWidthPx: 1,
}

function posIsInBounds(pos: v2): boolean {
    const result = pos.x >= 0 && pos.x < globalState.worldDim.x && pos.y >= 0 && pos.y < globalState.worldDim.y
    return result
}

function getEntityHandleAtPos(pos: v2): EntityHandle {
    const handle: EntityHandle = {index: 0, pos: {x: 0, y: 0}, entity: null};
    if (posIsInBounds(pos)) {
        handle.index = pos.y * globalState.worldDim.x + pos.x
        handle.pos = pos
        handle.entity = globalState.entities.storage[handle.index]
    }
    return handle
}

function startWorkingConditionally(handle: EntityHandle, condition: EntityKind, efficiency: number): void {
    if (handle.entity !== null) {
        handle.entity.currentRate = 0
        const entityOnLeftHandle = getEntityHandleAtPos({x: handle.pos.x - 1, y: handle.pos.y})
        if (entityOnLeftHandle.entity !== null && entityOnLeftHandle.entity.kind === condition) {
            handle.entity.currentRate = entityOnLeftHandle.entity.currentRate * efficiency
        }
    }
}

type EntityIterator = {
    handle: EntityHandle | null,
    iterPos: v2,
    done: boolean,
}

function beginEntityIteration(): EntityIterator {
    const iterator: EntityIterator = {handle: null, iterPos: {x: -1, y: 0}, done: false}
    return iterator
}

function nextEntity(iterator: EntityIterator): EntityIterator {
    if (!iterator.done) {
        iterator.iterPos.x += 1
        if (iterator.iterPos.x >= globalState.worldDim.x) {
            iterator.iterPos.x = 0
            iterator.iterPos.y += 1
            if (iterator.iterPos.y >= globalState.worldDim.y) {
                iterator.done = true
                iterator.handle = null
            }
        }
        if (!iterator.done) {
            iterator.handle = getEntityHandleAtPos(iterator.iterPos)
        }
    }
    return iterator
}

function nextNonNullEntity(iterator: EntityIterator): EntityIterator {
    do {
        nextEntity(iterator)
    } while (!iterator.done && iterator.handle?.entity?.kind === EntityKind.None)
    return iterator
}

function gameUpdateAndRender(timestamp: number): void {
    const deltaTime = timestamp - globalState.lastTimestamp
    globalState.lastTimestamp = timestamp

    // NOTE: Update

    // NOTE: Entities
    for (const entityIterator = nextNonNullEntity(beginEntityIteration()); !entityIterator.done; nextNonNullEntity(entityIterator)) {
        const entity = entityIterator.handle!.entity!
        switch (entity.kind) {
            case EntityKind.Producer: {
                startWorkingConditionally(entityIterator.handle!, EntityKind.Motor, 0.8)
            } break
            case EntityKind.Motor: {
                startWorkingConditionally(entityIterator.handle!, EntityKind.Generator, 0.5)
            } break
            case EntityKind.Generator: {
                const pos = entityIterator.handle!.pos
                const isCursorOver = Math.floor(globalState.cursor.pos.x) === pos.x && Math.floor(globalState.cursor.pos.y) === pos.y
                entity.currentRate = isCursorOver && globalState.cursor.leftButtonDown ? 1 : 0
            } break
            default: console.error(`unknown entity type: '${entity.kind}'`)
        }

        while (entity.cycleProgress >= 1) {
            entity.cycleProgress -= 1
        }
        entity.cycleProgress += deltaTime / globalState.referenceCycleDuration * entity.currentRate
    }

    // NOTE: Render

    const canvas = document.getElementById("canvas")! as HTMLCanvasElement

    const worldDimXPx = globalState.worldDim.x * globalState.cellDimPx
    const worldDimYPx = globalState.worldDim.y * globalState.cellDimPx
    canvas.setAttribute("width", `${worldDimXPx}`)
    canvas.setAttribute("height", `${worldDimYPx}`)

    const ctx = canvas.getContext("2d")!

    // NOTE: Clear
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, worldDimXPx, worldDimYPx)

    // NOTE: Grid
    {
        ctx.fillStyle = "gray"
        for (let currentXPx = 0; currentXPx <= worldDimXPx; currentXPx += globalState.cellDimPx) {
            ctx.fillRect(currentXPx - globalState.gridCellBorderWidthPx, 0, globalState.gridCellBorderWidthPx * 2, worldDimYPx)
        }
        for (let currentYPx = 0; currentYPx <= worldDimYPx; currentYPx += globalState.cellDimPx) {
            ctx.fillRect(0, currentYPx - globalState.gridCellBorderWidthPx, worldDimXPx, globalState.gridCellBorderWidthPx * 2)
        }
    }

    // NOTE: Entities
    for (const entityIterator = nextNonNullEntity(beginEntityIteration()); !entityIterator.done; nextNonNullEntity(entityIterator)) {
        const entity = entityIterator.handle!.entity!
        const pos = entityIterator.handle!.pos

        let cellBg = "magenta"
        let letter = "X"
        switch (entity.kind) {
            case EntityKind.Producer: {
                cellBg = "darkred"
                letter = "P"
            } break
            case EntityKind.Motor: {
                cellBg = "green"
                letter = "M"
            } break
            case EntityKind.Generator: {
                cellBg = "darkblue"
                letter = "G"
            } break
            default: console.error(`unknown entity type: '${entity.kind}'`)
        }

        const cellLeftPx = pos.x * globalState.cellDimPx
        const cellTopPx = pos.y * globalState.cellDimPx

        ctx.fillStyle = cellBg
        ctx.fillRect(cellLeftPx, cellTopPx, globalState.cellDimPx, globalState.cellDimPx)

        ctx.fillStyle = "white"
        ctx.textBaseline = "bottom"
        ctx.fillText(`${Math.floor(entity.cycleProgress * 100)}`, cellLeftPx, cellTopPx + globalState.cellDimPx)

        ctx.fillStyle = "black"
        ctx.textBaseline = "top"
        ctx.fillText(letter, cellLeftPx, cellTopPx)

        const orbitingSquareDimPx = 3
        const orbitingSquareHalfDimPx = orbitingSquareDimPx / 2
        const orbitingSquarePaddingPx = 1
        const cellHalfDim = globalState.cellDimPx / 2
        const orbitRadiusPx = cellHalfDim - globalState.gridCellBorderWidthPx - orbitingSquarePaddingPx - orbitingSquareDimPx

        const cellCenterXPx = cellLeftPx + cellHalfDim
        const cellCenterYPx = cellTopPx + cellHalfDim
        const proportionOfTimeWaited = entity.cycleProgress
        const currentAngleFromTop = proportionOfTimeWaited // NOTE: in turns, clockwise
        const orbitingSquareOffsetXPx = Math.sin(currentAngleFromTop * 2 * Math.PI) * orbitRadiusPx
        const orbitingSquareOffsetYPx = Math.cos(currentAngleFromTop * 2 * Math.PI) * orbitRadiusPx
        const orbitingSquareCenterXPx = cellCenterXPx + orbitingSquareOffsetXPx
        const orbitingSquareCenterYPx = cellCenterYPx - orbitingSquareOffsetYPx

        ctx.fillStyle = "lightgray"
        ctx.fillRect(orbitingSquareCenterXPx - orbitingSquareHalfDimPx, orbitingSquareCenterYPx - orbitingSquareHalfDimPx, orbitingSquareDimPx, orbitingSquareDimPx)
    }

    requestAnimationFrame(gameUpdateAndRender)
}

function main() {

    // NOTE: Input
    document.addEventListener("mousemove", (event) => {
        const canvas = document.getElementById("canvas")! as HTMLCanvasElement
        const canvasRect = canvas.getBoundingClientRect()
        const cursorXPx = event.clientX - canvasRect.left
        const cursorYPx = event.clientY - canvasRect.top
        globalState.cursor.pos.x = cursorXPx / globalState.cellDimPx
        globalState.cursor.pos.y = cursorYPx / globalState.cellDimPx
    })

    document.addEventListener("mousedown", (event) => {
        if (event.button === 0) {
            globalState.cursor.leftButtonDown = true
        }
    })

    document.addEventListener("mouseup", (event) => {
        if (event.button === 0) {
            globalState.cursor.leftButtonDown = false
        }
    })

    // NOTE: Init
    {
        const entityCount = globalState.worldDim.x * globalState.worldDim.y
        for (let entityIndex = 0; entityIndex < entityCount; entityIndex++) {
            globalState.entities.storage.push({
                kind: EntityKind.None,
                currentRate: 0,
                cycleProgress: 0,
            })
        }

        // NOTE: Temp setup some test entities
        {
            const handle = getEntityHandleAtPos({x: 0, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Generator
            }
        }
        {
            const handle = getEntityHandleAtPos({x: 1, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Motor
            }
        }
        {
            const handle = getEntityHandleAtPos({x: 2, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Producer
            }
        }
    }

    // NOTE: Mainloop
    requestAnimationFrame((timestamp) => {
        globalState.lastTimestamp = timestamp
        requestAnimationFrame(gameUpdateAndRender)
    })
}
