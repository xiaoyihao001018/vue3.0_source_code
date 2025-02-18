import { track, trigger } from './effect'

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.RAW]?: any
}

const reactiveMap = new WeakMap<Target, any>()

export function reactive(target: object) {
  console.log('创建响应式对象:', target)
  
  // 如果不是对象，直接返回
  if (!target || typeof target !== 'object') {
    return target
  }

  // 如果对象已经是响应式的，直接返回
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }

  // 如果这个对象已经有对应的代理对象，直接返回缓存的代理
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 创建代理对象
  const proxy = new Proxy(target, {
    // 拦截属性读取操作
    get(target, key, receiver) {
      // 如果读取的是 IS_REACTIVE 标记，返回 true 表示这是个响应式对象
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }
      
      // 收集依赖：记录谁在使用这个属性
      track(target, key)
      
      // 返回属性值
      const res = Reflect.get(target, key, receiver)
      console.log('获取属性:', {
        target,
        key,
        value: res
      })
      return res
    },
    
    // 拦截属性设置操作
    set(target, key, value, receiver) {
      // 保存旧值
      const oldValue = target[key]
      // 设置新值
      const result = Reflect.set(target, key, value, receiver)
      
      // 如果值发生变化，触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }
      
      console.log('设置属性:', {
        target,
        key,
        oldValue: oldValue,
        newValue: value
      })
      return result
    }
  })

  // 缓存代理对象
  reactiveMap.set(target, proxy)
  
  return proxy
} 