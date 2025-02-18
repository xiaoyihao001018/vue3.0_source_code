import { describe, it } from 'vitest'
import { reactive, effect } from '../src'

describe('debug', () => {
  it('should track and trigger', () => {
    const state = reactive({ count: 0 })
    
    effect(() => {
      console.log('effect 执行:', state.count)
    })
    
    // 修改值观察日志
    state.count++
  })
}) 