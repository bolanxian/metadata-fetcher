
import { type VNode, defineComponent, shallowReactive, watchEffect, onMounted, createVNode as h, withDirectives } from 'vue'
import { Alert, ButtonGroup, Button, Card, CellGroup, Cell, Divider, Drawer, Icon, Tag } from 'view-ui-plus'
import lineClamp from 'view-ui-plus/src/directives/line-clamp'
import { instantToString, formatDuration } from '../utils/temporal'
import { $string, $array, hasOwn } from '../bind'
import { BBDown } from './bbdown'
const { from } = Array
const { slice, startsWith } = $string, { join } = $array

export const toShortUrl = (id: string) => `https://b23.tv/${id}`
export const toUrl = (id: string) => `https://www.bilibili.com/video/${id}/`
export const toSpaceUrl = (id: string) => `https://space.bilibili.com/${id}/`
export const copyrightMap = new Map([[1, '自制'], [2, '转载']])
export const copyrightValues = join([...copyrightMap.values()], ',')
export const enum ArgueType {
  NEUTRAL = 0,
  GENERAL_NEGATIVE = 1,
  STRONG_NEGATIVE = 2,
}
export const enum DescInfoType {
  ORDINARY = 1,
  USER_HREF = 2,
}
/*<component>*/
const $a = { referrerpolicy: 'no-referrer', target: '_blank' }
const $img = { referrerpolicy: 'no-referrer' }

const renderArgue = ({ argue_info: info }: any, inner: VNode): (VNode | null)[] => {
  const msg = info?.argue_msg
  if (!msg) { return [null, inner, null] }
  let before = false
  let color = 'default'
  let type: string = null!
  switch (info.argue_type) {
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
  const argue = h(Tag, { color }, () => [
    type != null ? h(Icon, { type }) : null, msg
  ])
  return [
    before ? argue : null,
    inner,
    before ? null : argue
  ]
}

export default defineComponent({
  props: { data: null as any },
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
      & Record<'error' | 'thumb' | 'date' | 'copyright', string | null>
      & Record<'pagesTitle' | 'episodesTitle', string>
      & Record<'channel' | 'subChannel', any>
    watchEffect(() => {
      const $data = props.data
      data = {
        error: '',
        thumb: null,
        date: null,
        copyright: null,
        pagesTitle: '分P',
        episodesTitle: '合集',
        channel: null,
        subChannel: null,
      }
      if ($data == null) { return }
      const { error, channelKv, videoData } = $data
      data.error = error.message
      if (data.error != null) { return }
      data.thumb = videoData.pic ?? ''
      if (startsWith(data.thumb!, 'http:')) {
        data.thumb = `https:${slice(data.thumb!, 5)}`
      }
      data.date = instantToString(videoData.pubdate * 1000, true)
      data.copyright = copyrightMap.get(videoData.copyright) ?? '未知'
      data.pagesTitle = `分P[${videoData.pages.length}]`
      if (videoData.ugc_season != null) {
        const { title, ep_count } = videoData.ugc_season
        data.episodesTitle = `${title}[${ep_count}]`
      }
      if (channelKv != null) {
        for (const channel of channelKv) {
          if (!hasOwn(channel, 'sub')) { continue }
          for (const sub of channel.sub) {
            if (sub.tid === videoData.tid && sub.name === videoData.tname) {
              data.channel = channel
              data.subChannel = sub
              return
            }
          }
        }
        for (const channel of channelKv) {
          if (channel.tid === videoData.tid && channel.name === videoData.tname) {
            data.channel = channel
            data.subChannel = null
            return
          }
        }
      }
      data.channel = { name: videoData.tname, url: '#' }
      data.subChannel = null
    })
    const handle = {
      drawerParts() { state.drawer = 'parts' },
      drawerEpisodes() { state.drawer = 'episodes' },
      drawerChildren: () => state.drawerChildren,
      drawerModelValue(_: boolean) { _ || (state.drawer = null) }
    }
    watchEffect(() => {
      const { videoData } = props.data
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
        return [
          h(Card, null, () => [h(Alert, { type: 'error', showIcon: true }, () => [data.error])])
        ]
      }
      const { tags, videoData } = props.data
      const id = `av${videoData.aid}`
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
            h('img', { ...$img, src: owner.face })
          ])),
          default: () => [
            h('div', null, [
              data.channel != null ? h('a', { ...$a, href: data.channel.url }, [
                h(Tag, { color: 'blue' }, () => [data.channel.name])
              ]) : null,
              data.subChannel != null ? h('a', { ...$a, href: data.subChannel.url, title: data.subChannel.desc }, [
                h(Tag, { color: 'blue' }, () => [data.subChannel.name])
              ]) : null,
              h(Tag, { color: 'cyan', title: `视频类型[${copyrightValues}]` }, () => [data.copyright]),
              h('a', { ...$a, href: toUrl(id) }, [
                h(Tag, { color: 'blue' }, () => [id])
              ]),
              h('a', { ...$a, href: toUrl(videoData.bvid) }, [
                h(Tag, { color: 'blue' }, () => [videoData.bvid])
              ]),
            ]),
            h('div', null, from(tags, (tag: any) => {
              switch (tag.tag_type ?? null) {
                case 'bgm':
                  return h('a', { ...$a, href: tag.jump_url }, [
                    h(Tag, { color: 'primary' }, () => [h(Icon, { type: 'ios-musical-notes' }), tag.tag_name])
                  ])
                case 'topic':
                  return h('a', { ...$a, href: tag.jump_url }, [
                    h(Tag, { color: 'primary' }, () => [h(Icon, { type: 'ios-paper-plane' }), tag.tag_name])
                  ])
                case 'old_channel': case null:
                  return h(Tag, null, () => [tag.tag_name])
              }
              return null
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
              h(BBDown, { id })
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
})

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