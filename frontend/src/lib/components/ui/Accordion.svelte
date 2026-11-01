<script lang="ts">
  let { children, class: customClass = '' } = $props<{
    children: any
    class?: string
  }>()
</script>

<div class="shadcn-accordion {customClass}">
  {@render children()}
</div>

<style>
  .shadcn-accordion {
    width: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
