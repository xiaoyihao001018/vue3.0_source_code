import { describe, it, expect } from 'vitest'
import { reactive, effect } from '../src'

describe('reactive', () => {
  it('should be reactive', () => {
    const original = { count: 0 }
    const observed = reactive(original)
    
    let dummy
    effect(() => {
      dummy = observed.count
    })
    
    expect(dummy).toBe(0)
    observed.count = 1
    expect(dummy).toBe(1)
  })
})

// 创建一个响应式对象
const state = reactive({
  count: 0,
  message: 'Hello'
})

// 创建一个副作用函数来观察数据变化
effect(() => {
  console.log('当前count值:', state.count)
  console.log('当前message值:', state.message)
})

// 修改数据，会自动触发上面的effect执行
state.count++
state.message = 'Hello Vue3' 