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
    worldMargins: {top: number, bottom: number, left: number, right: number},
    currentNumber: number,
}

function posIsInBounds(pos: v2, bounds: v2): boolean {
    const result = pos.x >= 0 && pos.x < bounds.x && pos.y >= 0 && pos.y < bounds.y
    return result
}

function getEntityHandleAtPos(gameState: GameState, pos: v2): EntityHandle {
    const handle: EntityHandle = {index: 0, pos: {x: 0, y: 0}, entity: null};
    if (posIsInBounds(pos, gameState.worldDim)) {
        handle.index = pos.y * gameState.worldDim.x + pos.x
        handle.pos = pos
        handle.entity = gameState.entities.storage[handle.index]
    }
    return handle
}

function startWorkingConditionally(gameState: GameState, handle: EntityHandle, condition: EntityKind, efficiency: number): void {
    if (handle.entity !== null) {
        handle.entity.currentRate = 0
        const entityOnLeftHandle = getEntityHandleAtPos(gameState, {x: handle.pos.x - 1, y: handle.pos.y})
        if (entityOnLeftHandle.entity !== null && entityOnLeftHandle.entity.kind === condition) {
            handle.entity.currentRate = entityOnLeftHandle.entity.currentRate * efficiency
        }
    }
}

type EntityIterator = {
    handle: EntityHandle | null,
    iterPos: v2,
    done: boolean,
    gameState: GameState,
}

function beginEntityIteration(gameState: GameState): EntityIterator {
    const iterator: EntityIterator = {handle: null, iterPos: {x: -1, y: 0}, done: false, gameState: gameState}
    return iterator
}

function nextEntity(iterator: EntityIterator): EntityIterator {
    if (!iterator.done) {
        iterator.iterPos.x += 1
        if (iterator.iterPos.x >= iterator.gameState.worldDim.x) {
            iterator.iterPos.x = 0
            iterator.iterPos.y += 1
            if (iterator.iterPos.y >= iterator.gameState.worldDim.y) {
                iterator.done = true
                iterator.handle = null
            }
        }
        if (!iterator.done) {
            iterator.handle = getEntityHandleAtPos(iterator.gameState, iterator.iterPos)
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

function gameUpdateAndRender(gameState: GameState, deltaTime: number): void {

    // NOTE: Update Entities
    for (const entityIterator = nextNonNullEntity(beginEntityIteration(gameState)); !entityIterator.done; nextNonNullEntity(entityIterator)) {
        const entity = entityIterator.handle!.entity!
        switch (entity.kind) {
            case EntityKind.Producer: {
                startWorkingConditionally(gameState, entityIterator.handle!, EntityKind.Motor, 0.8)
                gameState.currentNumber += entity.currentRate * deltaTime / gameState.referenceCycleDuration
            } break
            case EntityKind.Motor: {
                startWorkingConditionally(gameState, entityIterator.handle!, EntityKind.Generator, 0.5)
            } break
            case EntityKind.Generator: {
                const pos = entityIterator.handle!.pos
                const isCursorOverX = Math.floor((gameState.cursor.pos.x - gameState.worldMargins.left) / gameState.cellDimPx) === pos.x
                const isCursorOverY = Math.floor((gameState.cursor.pos.y - gameState.worldMargins.top) / gameState.cellDimPx) === pos.y
                const isCursorOver = isCursorOverX && isCursorOverY
                entity.currentRate = isCursorOver && gameState.cursor.leftButtonDown ? 1 : 0
            } break
            default: console.error(`unknown entity type: '${entity.kind}'`)
        }

        while (entity.cycleProgress >= 1) {
            entity.cycleProgress -= 1
        }
        entity.cycleProgress += deltaTime / gameState.referenceCycleDuration * entity.currentRate
    }

    // NOTE: Render

    const canvas = document.getElementById("canvas")! as HTMLCanvasElement

    const worldDimXPx = gameState.worldDim.x * gameState.cellDimPx
    const worldDimYPx = gameState.worldDim.y * gameState.cellDimPx

    const canvasTotalHeightPx = worldDimYPx + gameState.worldMargins.top + gameState.worldMargins.bottom
    const canvasTotalWidthPx = worldDimXPx + gameState.worldMargins.left + gameState.worldMargins.right

    canvas.setAttribute("width", `${canvasTotalWidthPx}`)
    canvas.setAttribute("height", `${canvasTotalHeightPx}`)

    const worldDimLeftPx = gameState.worldMargins.left
    const worldDimTopPx = gameState.worldMargins.top
    const worldDimRightPx = worldDimLeftPx + worldDimXPx
    const worldDimBottomPx = worldDimTopPx + worldDimYPx

    const ctx = canvas.getContext("2d")!

    // NOTE: Clear
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvasTotalWidthPx, canvasTotalHeightPx)

    // NOTE: Grid
    {
        ctx.fillStyle = "gray"
        for (let currentXPx = worldDimLeftPx; currentXPx <= worldDimRightPx; currentXPx += gameState.cellDimPx) {
            ctx.fillRect(currentXPx - gameState.gridCellBorderWidthPx, worldDimTopPx, gameState.gridCellBorderWidthPx * 2, worldDimYPx)
        }
        for (let currentYPx = worldDimTopPx; currentYPx <= worldDimBottomPx; currentYPx += gameState.cellDimPx) {
            ctx.fillRect(worldDimLeftPx, currentYPx - gameState.gridCellBorderWidthPx, worldDimXPx, gameState.gridCellBorderWidthPx * 2)
        }
    }

    // NOTE: Margins
    {
        ctx.fillStyle = "#222222"
        ctx.fillRect(0, 0, canvasTotalWidthPx, gameState.worldMargins.top)
        ctx.fillRect(0, worldDimBottomPx, canvasTotalWidthPx, gameState.worldMargins.bottom)
        ctx.fillRect(0, 0, gameState.worldMargins.left, canvasTotalHeightPx)
        ctx.fillRect(worldDimRightPx, 0, gameState.worldMargins.right, canvasTotalHeightPx)
    }

    // NOTE: Number
    {
        const topMarginCenterXPx = gameState.worldMargins.left + worldDimXPx / 2
        ctx.fillStyle = "white"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = `${gameState.worldMargins.top}px monospace`
        ctx.fillText(`${Math.floor(gameState.currentNumber)}`, topMarginCenterXPx, gameState.worldMargins.top / 2)
    }

    // NOTE: Render Entities
    for (const entityIterator = nextNonNullEntity(beginEntityIteration(gameState)); !entityIterator.done; nextNonNullEntity(entityIterator)) {
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

        const cellLeftPx = worldDimLeftPx + pos.x * gameState.cellDimPx + gameState.gridCellBorderWidthPx
        const cellTopPx = worldDimTopPx + pos.y * gameState.cellDimPx + gameState.gridCellBorderWidthPx
        const cellDimPx = gameState.cellDimPx - gameState.gridCellBorderWidthPx * 2

        ctx.fillStyle = cellBg
        ctx.fillRect(cellLeftPx, cellTopPx, cellDimPx, cellDimPx)

        ctx.fillStyle = "white"
        ctx.textBaseline = "bottom"
        ctx.textAlign = "left"
        ctx.font = `10px monospace`
        ctx.fillText(`${Math.floor(entity.cycleProgress * 100)}`, cellLeftPx, cellTopPx + cellDimPx)

        ctx.fillStyle = "black"
        ctx.textBaseline = "top"
        ctx.textAlign = "left"
        ctx.font = `20px monospace`
        ctx.fillText(letter, cellLeftPx, cellTopPx)

        const orbitingSquareDimPx = 3
        const orbitingSquareHalfDimPx = orbitingSquareDimPx / 2
        const orbitingSquarePaddingPx = 1
        const cellHalfDim = cellDimPx / 2
        const orbitRadiusPx = cellHalfDim - orbitingSquarePaddingPx - orbitingSquareDimPx

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
}

function main() {
        
    let gameState: GameState = {
        lastTimestamp: 0,
        worldDim: {x: 10, y: 10},
        cursor: {pos: {x: 0, y: 0}, leftButtonDown: false},
        entities: {
            storage: [],
        },
        referenceCycleDuration: 1000,
        cellDimPx: 50,
        gridCellBorderWidthPx: 1,
        worldMargins: {top: 20, bottom: 30, left: 40, right: 50},
        currentNumber: 0,
    }

    // NOTE: Input
    document.addEventListener("mousemove", (event) => {
        const canvas = document.getElementById("canvas")! as HTMLCanvasElement
        const canvasRect = canvas.getBoundingClientRect()
        const cursorXPx = event.clientX - canvasRect.left
        const cursorYPx = event.clientY - canvasRect.top
        gameState.cursor.pos.x = cursorXPx
        gameState.cursor.pos.y = cursorYPx
    })

    document.addEventListener("mousedown", (event) => {
        if (event.button === 0) {
            gameState.cursor.leftButtonDown = true
        }
    })

    document.addEventListener("mouseup", (event) => {
        if (event.button === 0) {
            gameState.cursor.leftButtonDown = false
        }
    })

    // NOTE: Init
    {
        const entityCount = gameState.worldDim.x * gameState.worldDim.y
        for (let entityIndex = 0; entityIndex < entityCount; entityIndex++) {
            gameState.entities.storage.push({
                kind: EntityKind.None,
                currentRate: 0,
                cycleProgress: 0,
            })
        }

        // NOTE: Temp setup some test entities
        {
            const handle = getEntityHandleAtPos(gameState, {x: 0, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Generator
            }
        }
        {
            const handle = getEntityHandleAtPos(gameState, {x: 1, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Motor
            }
        }
        {
            const handle = getEntityHandleAtPos(gameState, {x: 2, y: 5})
            if (handle?.entity !== null) {
                handle.entity.kind = EntityKind.Producer
            }
        }
    }

    // NOTE: Mainloop
    requestAnimationFrame((timestamp) => {
        let lastTimestamp = timestamp
        function gameUpdateAndRenderWrapper(timestamp: number): void {
            const deltaTime = timestamp - lastTimestamp
            lastTimestamp = timestamp
            gameUpdateAndRender(gameState, deltaTime)
            requestAnimationFrame(gameUpdateAndRenderWrapper)
        }
        requestAnimationFrame(gameUpdateAndRenderWrapper)
    })
}
