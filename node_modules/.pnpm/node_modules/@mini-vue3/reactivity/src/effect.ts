// 定义依赖的类型：一个 Set 集合，存储着相关的副作用函数
type Dep = Set<ReactiveEffect>
// 定义依赖图的类型：一个 Map，key 是对象的属性，value 是该属性的依赖集合
type KeyToDepMap = Map<any, Dep>
// 全局的依赖图，使用 WeakMap 避免内存泄漏
// WeakMap 的 key 是原始对象，value 是这个对象的依赖图
const targetMap = new WeakMap<any, KeyToDepMap>()

// 当前正在执行的副作用函数，全局变量
export let activeEffect: ReactiveEffect | undefined

// 副作用函数类，用于封装用户传入的函数
export class ReactiveEffect<T = any> {
  // 标记这个 effect 是否处于激活状态
  active = true
  // 存储这个 effect 依赖的所有属性的集合数组
  deps: Dep[] = []
  
  constructor(
    // 用户传入的函数，会在依赖更新时重新执行
    public fn: () => T,
    // 可选的调度器函数，用于自定义更新时的行为
    public scheduler: (() => void) | null = null
  ) {}

  // 运行副作用函数
  run() {
    // 如果不是激活状态，仅执行函数，不收集依赖
    if (!this.active) {
      return this.fn()
    }

    try {
      // 设置当前活跃的 effect
      activeEffect = this
      // 执行用户函数，这个过程中会触发代理对象的 get，从而收集依赖
      return this.fn()
    } finally {
      // 执行完后清空当前活跃的 effect
      activeEffect = undefined
    }
  }

  // 停止这个 effect 的依赖收集
  stop() {
    if (this.active) {
      this.active = false
      // 清理所有依赖
      cleanupEffect(this)
    }
  }
}

// 创建一个响应式的副作用函数
export function effect<T = any>(fn: () => T) {
  // 创建 ReactiveEffect 实例
  const _effect = new ReactiveEffect(fn)
  // 立即执行一次副作用函数，进行依赖收集
  _effect.run()
  
  // 返回绑定了 this 的 run 函数
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}

// 依赖收集函数
export function track(target: object, key: unknown) {
  if (!activeEffect) return
  
  console.log('收集依赖:', {
    target,
    key,
    effect: activeEffect
  })
  // 获取当前对象的依赖图
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 如果没有，则创建一个新的
    targetMap.set(target, (depsMap = new Map()))
  }
  
  // 获取当前属性的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    // 如果没有，则创建一个新的
    depsMap.set(key, (dep = new Set()))
  }
  
  // 如果依赖集合中还没有当前 effect，则添加
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    // 同时在 effect 中也记录这个依赖集合
    activeEffect.deps.push(dep)
  }
}

// 触发更新函数
export function trigger(target: object, key: unknown) {
  console.log('触发更新:', {
    target,
    key
  })
  // 获取对象的依赖图
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  // 获取属性的依赖集合
  const dep = depsMap.get(key)
  if (dep) {
    // 创建一个新的 Set 避免无限循环
    const effects = new Set(dep)
    // 执行所有相关的副作用函数
    effects.forEach(effect => {
      // 如果有调度器，则执行调度器，否则直接运行副作用函数
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        effect.run()
      }
    })
  }
}

// 清理 effect 的所有依赖
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    // 从所有依赖集合中移除这个 effect
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    // 清空 deps 数组
    deps.length = 0
  }
} 