import type { XRHandSpace } from 'three'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory'
import { useThrelte } from '@threlte/core'
import { onMount } from 'svelte'
import { left, right } from '../hooks/useHand'
import { useHandTrackingState } from './useHandTrackingState'
import type { XRHandEvent } from '../types'
import { handDispatchers } from './stores'

export const setupHands = () => {
  const factory = new XRHandModelFactory()
  const stores = { left, right } as const
  const { xr } = useThrelte().renderer
  const hasHands = useHandTrackingState()
  const handSpaces = [xr.getHand(0), xr.getHand(1)]
  const map = new Map()

  handSpaces.forEach((handSpace, index) => {
    map.set(handSpace, {
      hand: handSpace,
      targetRay: xr.getController(index),
      model: factory.createHandModel(handSpace, 'mesh')
    })
  })

  onMount(() => {
    const dispatch = (event: THREE.Event) => {
      if (!hasHands()) return
      console.log(event)
      const handedness = (event.handedness ?? event.data.handedness) as 'left' | 'right'
      handDispatchers[handedness]?.current?.(event.type, event)
    }
  
    function handleConnected (this: XRHandSpace, event: XRHandEvent) {
      const hand = this
      const { model, targetRay } = map.get(this)
      const { data } = event as { data: {
        handedness: 'left' | 'right'
        hand: XRHand
      } }
      const { handedness, hand: inputSource } = data

      stores[handedness].set({
        hand,
        model,
        inputSource,
        targetRay
      })

      dispatch(event)
    }

    const handleDisconnected = (event: XRHandEvent<'disconnected'>) => {
      dispatch(event)
      stores[event.data.handedness].set(undefined)
    }  

    for (const handSpace of handSpaces) {
      handSpace.addEventListener('connected', handleConnected)
      handSpace.addEventListener('disconnected', handleDisconnected)
      handSpace.addEventListener('pinchstart', dispatch)
      handSpace.addEventListener('pinchend', dispatch)
    }

    return () => {
      for (const handSpace of handSpaces) {
        handSpace.removeEventListener('connected', handleConnected)
        handSpace.removeEventListener('disconnected', handleDisconnected)
        handSpace.removeEventListener('pinchstart', dispatch)
        handSpace.removeEventListener('pinchend', dispatch)
      }

      stores.left.set(undefined)
      stores.right.set(undefined)
    }
  })
}
