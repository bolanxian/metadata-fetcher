
import { type VNode, type Prop, defineComponent, shallowReactive, watchEffect, onMounted, createVNode as h, withDirectives } from 'vue'
import { Alert, ButtonGroup, Button, Card, CellGroup, Cell, Divider, Drawer, Icon, Tag } from 'view-ui-plus'
import lineClamp from 'view-ui-plus/src/directives/line-clamp'
import { hasOwn, getOwn } from 'bind:utils'
import { keys } from 'bind:Object'
import { from } from 'bind:Array'
import { BBDown } from './bbdown'
import { toHttps } from '@/bind'
import { instantToString, formatDuration } from '@/utils/temporal'
import { definePluginComponent } from '@/meta-fetch/plugin'
import { type Data, toUrl, toSpaceUrl, bilibiliVideo } from '@/meta-fetch/platforms/bilibili-video'

export const errorMap = {
  '-400': '请求错误',
  '-403': '权限不足',
  '-404': '无视频',
  62002: '稿件不可见',
  62004: '稿件审核中',
  62012: '仅UP主自己可见'
}
export const copyrightMap = { 1: '自制', 2: '转载' }
export const copyrightValues = JSON.stringify(copyrightMap)
export const enum ArgueType {
  NEUTRAL = 0,
  GENERAL_NEGATIVE = 1,
  STRONG_NEGATIVE = 2,
}
export const enum DescInfoType {
  ORDINARY = 1,
  USER_HREF = 2,
}

const $a = { referrerpolicy: 'no-referrer', target: '_blank' }
const $img = { referrerpolicy: 'no-referrer', fetchpriority: 'low' }

const renderHoner = (videoData: any): VNode[] | null => {
  const honor: any[] = getOwn(videoData.honor_reply, 'honor')
  if (!(honor?.length > 0)) { return null }
  const ret: VNode[] = []
  for (const { desc } of honor) {
    ret[ret.length] = h(Tag, { color: 'magenta' }, () => [desc])
  }
  return ret
}
const renderArgue = (videoData: any, inner: VNode): (VNode | null)[] => {
  const argue = getOwn(videoData, 'argue_info')
  const msg: string = getOwn(argue, 'argue_msg')
  if (!msg) { return [null, inner, null] }
  let before = false
  let color = 'default'
  let type: string = null!
  switch (argue.argue_type) {
    case ArgueType.STRONG_NEGATIVE:
      before = true; color = 'error'; type = 'ios-alert'
      break
    case ArgueType.GENERAL_NEGATIVE:
      before = true; color = 'warning'; type = 'ios-alert'
      break
    case ArgueType.NEUTRAL:
      type = 'ios-alert-outline'
      break
  }
  const $argue = h(Tag, { color }, () => [
    type != null ? h(Icon, { type }) : null, msg
  ])
  return [
    before ? $argue : null,
    inner,
    before ? null : $argue
  ]
}
type Channel = { name: string, url: string, desc?: string }
const resolveChannel = (videoData: { tid: number, tname: string }, channelKv: any): [Channel | null, Channel | null] => {
  const { tid, tname } = videoData
  if (channelKv != null) {
    for (const channel of channelKv) {
      if (!hasOwn(channel, 'sub')) { continue }
      for (const sub of channel.sub) {
        if (sub.tid === tid && (tname ? sub.name === tname : true)) {
          return [channel, sub]
        }
      }
    }
    for (const channel of channelKv) {
      if (channel.tid === tid && (tname ? channel.name === tname : true)) {
        return [channel, null]
      }
    }
  }
  return [null, { name: tname, url: '' }]
}

export default definePluginComponent(bilibiliVideo, defineComponent({
  props: { data: null! as Prop<Data> },
  setup(props, ctx) {
    const state = shallowReactive<{
      drawer: 'parts' | 'episodes' | null | undefined
      drawerTitle: string
      drawerChildren: VNode[]
    }>({
      drawer: void 0,
      drawerTitle: '',
      drawerChildren: null!
    })
    onMounted(() => { state.drawer = null })
    let data:
      & Record<'error' | 'id' | 'thumb' | 'date' | 'copyright', string | null>
      & Record<'pagesTitle' | 'episodesTitle', string>
      & Record<'channel' | 'subChannel' | 'channel_v2' | 'subChannel_v2', Channel | null>
    watchEffect(() => {
      const $data = props.data
      data = {
        error: null,
        id: null,
        thumb: null,
        date: null,
        copyright: null,
        pagesTitle: '分P',
        episodesTitle: '合集',
        channel: null,
        subChannel: null,
        channel_v2: null,
        subChannel_v2: null,
      }
      if ($data == null) { return }
      const { error, channelKv, videoData } = $data
      if (error != null && keys(error).length !== 0) {
        data.error = getOwn(errorMap, +error.code) ?? error.message ?? '未知错误'
        return
      }
      data.id = `av${videoData.aid}`
      data.thumb = toHttps(videoData.pic ?? '')
      data.date = instantToString(videoData.pubdate * 1000, true)
      data.copyright = getOwn(copyrightMap, +videoData.copyright) ?? '未知'
      data.pagesTitle = `分P[${videoData.pages.length}]`
      if (videoData.ugc_season != null) {
        const { title, ep_count } = videoData.ugc_season
        data.episodesTitle = `${title}[${ep_count}]`
      }
      !([data.channel, data.subChannel] = resolveChannel(videoData, channelKv))
      if (hasOwn(videoData, 'tid_v2') && hasOwn(videoData, 'tname_v2')) {
        const dummyData = { tid: videoData.tid_v2, tname: videoData.tname_v2 }
        !([data.channel_v2, data.subChannel_v2] = resolveChannel(dummyData, channelKv))
      }
    })
    const handle = {
      drawerParts() { state.drawer = 'parts' },
      drawerEpisodes() { state.drawer = 'episodes' },
      drawerChildren: () => state.drawerChildren,
      drawerModelValue(_: boolean) { _ || (state.drawer = null) }
    }
    watchEffect(() => {
      const { videoData } = props.data!
      switch (state.drawer) {
        case 'parts':
          state.drawerTitle = data.pagesTitle
          state.drawerChildren = renderDrawerParts(videoData)
          break
        case 'episodes':
          state.drawerTitle = data.episodesTitle
          state.drawerChildren = renderDrawerEpisodes(videoData)
          break
      }
    })

    return () => {
      if (data.error != null) {
        const { error } = props.data!
        return [
          h(Card, null, () => [
            h(Alert, {
              type: 'error', showIcon: true,
              title: `${error.code}:${error.message}`
            }, () => [data.error])
          ])
        ]
      }
      const { id } = data, { tags, videoData } = props.data!
      return [
        h(Card, null, {
          title: () => [
            withDirectives(h('div', {
              style: 'margin-right:40px;line-height:1.2em;font-size:1.2em', title: videoData.title
            }, [videoData.title]), [
              [lineClamp, 1]
            ]),
            h('div', null, renderArgue(videoData, h(Tag, {
              color: 'blue', title: '30小时制'
            }, () => [data.date])))
          ],
          extra: () => from(videoData.staff ?? [videoData.owner], (owner: any) => h('a', {
            ...$a, class: 'ivu-avatar ivu-avatar-square ivu-avatar-image ivu-avatar-large',
            href: toSpaceUrl(owner.mid),
            title: `${owner.title != null ? `[${owner.title}]` : ''}${owner.name}`
          }, [
            h('img', { ...$img, src: toHttps(owner.face) })
          ])),
          default: () => [
            h('div', null, [
              h('a', {
                ...$a,
                href: data.subChannel?.url || data.channel?.url || null,
                title: `tid=${videoData.tid}\n${data.subChannel?.desc ?? ''}`
              }, [
                h(Tag, { color: 'blue' }, () => [
                  data.channel?.name,
                  h(Icon, { type: 'ios-arrow-forward' }),
                  data.subChannel?.name
                ])
              ]),
              data.channel_v2 != null || data.subChannel_v2 != null ? h('a', {
                ...$a,
                href: data.subChannel_v2?.url || data.channel_v2?.url || null,
                title: `tid_v2=${videoData.tid_v2}\n${data.subChannel_v2?.desc ?? ''}`
              }, [
                h(Tag, { color: 'blue' }, () => [
                  data.channel_v2?.name,
                  h(Icon, { type: 'ios-arrow-forward' }),
                  data.subChannel_v2?.name
                ])
              ]) : null,
              h(Tag, { color: 'cyan', title: `视频类型=${videoData.copyright}\n${copyrightValues}` }, () => [data.copyright]),
              h('a', { ...$a, href: toUrl(id!) }, [
                h(Tag, { color: 'blue' }, () => [id])
              ]),
              h('a', { ...$a, href: toUrl(videoData.bvid) }, [
                h(Tag, { color: 'blue' }, () => [videoData.bvid])
              ]),
            ]),
            h('div', null, renderHoner(videoData)),
            h('div', null, from(tags, (tag: any) => {
              const title = `${tag.tag_name}\ntag_type=${tag.tag_type}`
              let type: string | null = null
              switch (tag.tag_type ?? null) {
                case 'bgm': type = 'ios-musical-notes'; break
                case 'topic': type = 'ios-paper-plane'; break
                // case 'old_channel':
              }
              if (type != null) {
                return h('a', { ...$a, href: tag.jump_url, title }, [
                  h(Tag, { color: 'primary' }, () => [h(Icon, { type }), tag.tag_name])
                ])
              }
              return h(Tag, { title }, () => [tag.tag_name])
            })),
            h('img', {
              ...$img, style: 'margin-top:16px;width:100%',
              src: data.thumb, title: data.thumb
            }),
            h(Divider, { style: 'margin:16px 0' }),
            h('div', {
              title: `动态${videoData.dynamic ? '' : '为空'}`, style: 'white-space:pre-line'
            }, [videoData.dynamic || '\u200B']),
            h(Divider, { style: 'margin:16px 0' }),
            h('div', {
              title: `简介${videoData.desc_v2 != null ? '' : '为空'}`, style: 'white-space:pre-line'
            }, from(videoData.desc_v2 ?? [{ type: 1, raw_text: '\u200B' }], (_: any) => {
              switch (_.type) {
                case DescInfoType.ORDINARY: return _.raw_text
                case DescInfoType.USER_HREF: return h('a', { ...$a, href: toSpaceUrl(_.biz_id) }, [`@${_.raw_text} `])
              }
            })),
            h(Divider, { style: 'margin:16px 0' }),
            h(ButtonGroup, null, () => [
              h(Button, {
                disabled: state.drawer === void 0,
                onClick: handle.drawerParts
              }, () => [data.pagesTitle]),
              h(Button, {
                disabled: state.drawer === void 0 || videoData.ugc_season == null,
                onClick: handle.drawerEpisodes
              }, () => [data.episodesTitle]),
              import.meta.env.TARGET !== 'pages' ? h(BBDown, { id }) : null
            ]),
            state.drawer !== void 0 ? h(Drawer, {
              width: 512,
              title: state.drawerTitle,
              modelValue: state.drawer != null,
              'onUpdate:modelValue': handle.drawerModelValue
            }, handle.drawerChildren) : null
          ]
        })
      ]
    }
  }
}))

const renderDrawerParts = (videoData: any) => [h(CellGroup, null, () => from(
  videoData.pages, (page: any) => h(Cell, {
    title: page.part,
    extra: formatDuration(page.duration)
  }, {
    label: () => [
      h('a', { ...$a, href: `${toUrl(`av${videoData.aid}`)}?p=${page.page}` }, [`cid:${page.cid}`])
    ]
  })
))]
const renderDrawerEpisodes = (videoData: any) => from(
  videoData.ugc_season.sections ?? [], (section: any) => h(Card, {
    title: `${section.title}[${section.episodes.length}]`
  }, () => [
    h(CellGroup, null, () => from(
      section.episodes, (episode: any) => h(Cell, {
        title: episode.title,
        extra: formatDuration(episode.arc.duration),
        selected: videoData.aid == episode.aid
      }, {
        label: () => {
          const id = `av${episode.aid}`
          return [h('a', { ...$a, href: toUrl(id) }, [id])]
        }
      })
    ))
  ])
)